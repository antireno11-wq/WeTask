import { BookingStatus, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity, hasRole } from "@/lib/auth";
import {
  assertTransition,
  type BookingActor,
  InvalidBookingTransitionError
} from "@/lib/booking-state-machine";
import { notifyBookingCompleted } from "@/lib/notification-events";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * El tasker marca que terminó el servicio. Transiciona el booking de
 * IN_PROGRESS (o ACCEPTED/CONFIRMED si saltó check-in) a
 * AWAITING_CUSTOMER_CONFIRMATION, dispara la notificación al cliente
 * para que confirme y eventualmente califique. Idempotente.
 *
 * Equivalente al endpoint /complete existente, pero con semántica de
 * "ceremonia de cierre" (check-out incluye timestamp + side-effects de
 * notificación enriquecida).
 */
export async function POST(req: NextRequest, context: { params: { bookingId: string } }) {
  try {
    const identity = getRequestIdentity(req);
    if (!identity.userId || !hasRole(identity.role, [UserRole.PRO, UserRole.ADMIN])) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: context.params.bookingId },
      include: {
        customer: { select: { id: true, fullName: true, email: true } },
        pro: { select: { id: true, fullName: true, email: true } },
        service: { select: { name: true } }
      }
    });
    if (!booking) return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });

    if (identity.role === UserRole.PRO && identity.userId !== booking.proId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    if (booking.paymentStatus !== "PAID") {
      return NextResponse.json({ error: "El pago debe estar confirmado." }, { status: 409 });
    }

    // Idempotencia: si ya pasó por check-out, devolver OK sin re-notificar.
    if (booking.checkOutAt && booking.status === BookingStatus.AWAITING_CUSTOMER_CONFIRMATION) {
      return NextResponse.json({ ok: true, deduped: true, booking }, { status: 200 });
    }

    const actor: BookingActor = identity.role === UserRole.ADMIN ? "ADMIN" : "PRO";
    try {
      assertTransition(booking.status, BookingStatus.AWAITING_CUSTOMER_CONFIRMATION, actor);
    } catch (transitionError) {
      if (transitionError instanceof InvalidBookingTransitionError) {
        return NextResponse.json(
          {
            error: "El estado actual no permite cerrar el servicio.",
            from: transitionError.from
          },
          { status: 409 }
        );
      }
      throw transitionError;
    }

    const now = new Date();
    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: BookingStatus.AWAITING_CUSTOMER_CONFIRMATION,
        checkOutAt: now
      },
      select: { id: true, status: true, checkOutAt: true }
    });

    if (booking.customer && booking.pro) {
      await notifyBookingCompleted({
        customer: {
          userId: booking.customer.id,
          email: booking.customer.email,
          fullName: booking.customer.fullName,
          role: "CUSTOMER"
        },
        pro: {
          userId: booking.pro.id,
          email: booking.pro.email,
          fullName: booking.pro.fullName,
          role: "PRO"
        },
        bookingId: booking.id,
        serviceName: booking.service?.name ?? "tu servicio"
      });
    }

    return NextResponse.json({ ok: true, booking: updated }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "No se pudo cerrar el servicio", detail: error instanceof Error ? error.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
