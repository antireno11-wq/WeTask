import { PayoutStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity, SESSION_COOKIE_NAME } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimit, tooManyRequestsResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const GRACE_PERIOD_DAYS = 30;

/**
 * Ley 19.628 + LGPD — soft-delete con grace period de 30 días.
 * Marca `deletedAt` y `scheduledDeletionAt`. Una vez vencido el grace, un
 * cron (no incluido en Fase 14, ver deuda) ejecuta el hard-delete real.
 *
 * Rechaza el delete si el usuario tiene bookings activos (IN_PROGRESS,
 * AWAITING_CUSTOMER_CONFIRMATION, ON_THE_WAY, etc.) — primero debe completar
 * o disputar esas reservas.
 *
 * Cierra la sesión limpiando la cookie.
 */
export async function DELETE(req: NextRequest) {
  const identity = getRequestIdentity(req);
  if (!identity.userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const rl = await rateLimit("me.account_delete", `${identity.userId}:${getClientIp(req)}`, "3/h");
  if (!rl.success) return tooManyRequestsResponse(rl) as unknown as NextResponse;

  const user = await prisma.user.findUnique({
    where: { id: identity.userId },
    select: { id: true, deletedAt: true, scheduledDeletionAt: true }
  });

  if (!user) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  if (user.deletedAt) {
    return NextResponse.json(
      {
        ok: true,
        alreadyScheduled: true,
        scheduledDeletionAt: user.scheduledDeletionAt
      },
      { status: 200 }
    );
  }

  const blockingStatuses = ["CONFIRMED", "ON_THE_WAY", "IN_PROGRESS", "AWAITING_CUSTOMER_CONFIRMATION"] as const;
  const activeBookings = await prisma.booking.count({
    where: {
      OR: [
        { customerId: identity.userId, status: { in: blockingStatuses as unknown as never } },
        { proId: identity.userId, status: { in: blockingStatuses as unknown as never } }
      ]
    }
  });

  if (activeBookings > 0) {
    return NextResponse.json(
      {
        error: "Tienes reservas activas. Espera a que se completen o ábrelas como reclamo antes de eliminar tu cuenta.",
        activeBookings
      },
      { status: 409 }
    );
  }

  // ADM-09: tampoco permitir el borrado con dinero o disputas en juego.
  const [pendingPayouts, openDisputes] = await Promise.all([
    prisma.payout.count({
      where: { proId: identity.userId, status: { in: [PayoutStatus.PENDING, PayoutStatus.PROCESSING] } }
    }),
    prisma.disputeTicket.count({
      where: {
        status: { in: ["OPEN", "IN_REVIEW"] },
        booking: { OR: [{ customerId: identity.userId }, { proId: identity.userId }] }
      }
    })
  ]);

  if (pendingPayouts > 0 || openDisputes > 0) {
    return NextResponse.json(
      {
        error: "Tienes pagos o reclamos en curso. Deben resolverse antes de eliminar tu cuenta.",
        pendingPayouts,
        openDisputes
      },
      { status: 409 }
    );
  }

  const now = new Date();
  const scheduledDeletionAt = new Date(now.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

  await prisma.user.update({
    where: { id: identity.userId },
    data: {
      deletedAt: now,
      scheduledDeletionAt
    }
  });

  logger.info({ userId: identity.userId, scheduledDeletionAt }, "Cuenta marcada para eliminación");

  const response = NextResponse.json(
    {
      ok: true,
      message: `Tu cuenta será eliminada el ${scheduledDeletionAt.toISOString().slice(0, 10)}. Hasta esa fecha puedes cancelar la baja iniciando sesión y contactando soporte.`,
      scheduledDeletionAt
    },
    { status: 200 }
  );

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0
  });

  return response;
}
