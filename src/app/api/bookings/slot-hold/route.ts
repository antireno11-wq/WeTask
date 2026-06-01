import { UserRole } from "@prisma/client";
import { safeErrorDetail } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestIdentity, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const HOLD_DURATION_MINUTES = 5;

const holdSchema = z.object({
  slotId: z.string().min(1)
});

/**
 * Reserva un AvailabilitySlot temporalmente durante 5 minutos para que el
 * cliente complete el wizard de pago. Si el slot ya está tomado o tiene un
 * hold vigente de otro user, devuelve 409.
 *
 * El cron de Fase 6 limpia holds expirados (sin pago confirmado en 5min
 * el slot vuelve a estar disponible).
 */
export async function POST(req: NextRequest) {
  const identity = getRequestIdentity(req);
  if (!identity.userId || !hasRole(identity.role, [UserRole.CUSTOMER, UserRole.ADMIN])) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  let input: z.infer<typeof holdSchema>;
  try {
    input = holdSchema.parse(await req.json());
  } catch (error) {
    return NextResponse.json(
      { error: "Solicitud inválida", detail: safeErrorDetail(error) },
      { status: 400 }
    );
  }

  const holdExpiresAt = new Date(Date.now() + HOLD_DURATION_MINUTES * 60 * 1000);
  const now = new Date();

  // Lock optimista: solo tomamos el slot si está available o si su hold ya
  // expiró o si el hold actual nos pertenece (refresh idempotente).
  const result = await prisma.availabilitySlot.updateMany({
    where: {
      id: input.slotId,
      isAvailable: true,
      OR: [
        { holdExpiresAt: null },
        { holdExpiresAt: { lt: now } },
        { heldByUserId: identity.userId }
      ]
    },
    data: {
      holdExpiresAt,
      heldByUserId: identity.userId
    }
  });

  if (result.count === 0) {
    return NextResponse.json(
      { error: "El horario está tomado por otro cliente. Elige otro." },
      { status: 409 }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      slotId: input.slotId,
      holdExpiresAt,
      holdDurationMinutes: HOLD_DURATION_MINUTES
    },
    { status: 200 }
  );
}

/**
 * Libera el hold del usuario actual sobre un slot. Solo libera si el hold
 * le pertenece (no se puede robar el hold de otro).
 */
export async function DELETE(req: NextRequest) {
  const identity = getRequestIdentity(req);
  if (!identity.userId || !hasRole(identity.role, [UserRole.CUSTOMER, UserRole.ADMIN])) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const slotId = req.nextUrl.searchParams.get("slotId");
  if (!slotId) {
    return NextResponse.json({ error: "slotId requerido" }, { status: 400 });
  }

  const result = await prisma.availabilitySlot.updateMany({
    where: {
      id: slotId,
      heldByUserId: identity.userId
    },
    data: {
      holdExpiresAt: null,
      heldByUserId: null
    }
  });

  return NextResponse.json({ ok: true, released: result.count }, { status: 200 });
}
