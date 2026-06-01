import { BookingStatus, UserRole } from "@prisma/client";
import { safeErrorDetail } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity, hasRole } from "@/lib/auth";
import {
  assertTransition,
  type BookingActor,
  InvalidBookingTransitionError
} from "@/lib/booking-state-machine";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, context: { params: { bookingId: string } }) {
  try {
    const identity = getRequestIdentity(req);
    if (!hasRole(identity.role, [UserRole.CUSTOMER, UserRole.ADMIN])) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: context.params.bookingId },
      include: {
        payout: true,
        customer: { select: { fullName: true } },
        pro: { select: { id: true } }
      }
    });

    if (!booking) {
      return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
    }

    if (identity.role === UserRole.CUSTOMER && identity.userId !== booking.customerId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    if (booking.status !== "AWAITING_CUSTOMER_CONFIRMATION") {
      return NextResponse.json({ error: "Solo puedes confirmar servicios que estén esperando tu confirmación." }, { status: 400 });
    }

    const hasBlockingDispute = await prisma.disputeTicket.findFirst({
      where: { bookingId: booking.id, status: { in: ["OPEN", "IN_REVIEW"] } }
    });

    if (hasBlockingDispute) {
      return NextResponse.json({ error: "No puedes confirmar mientras exista un reclamo abierto." }, { status: 400 });
    }

    const actor: BookingActor = identity.role === UserRole.ADMIN ? "ADMIN" : "CUSTOMER";
    try {
      assertTransition(booking.status, BookingStatus.PAYOUT_SCHEDULED, actor);
    } catch (transitionError) {
      if (transitionError instanceof InvalidBookingTransitionError) {
        return NextResponse.json(
          { error: "El estado actual no permite confirmar el servicio.", from: transitionError.from },
          { status: 409 }
        );
      }
      throw transitionError;
    }

    const payoutAmount = Math.max(booking.totalPriceClp - booking.platformFeeClp, 0);

    const result = await prisma.$transaction(async (tx) => {
      const existingPayout = await tx.payout.findUnique({ where: { bookingId: booking.id } });
      const payout =
        existingPayout ??
        (await tx.payout.create({
          data: {
            bookingId: booking.id,
            proId: booking.proId!,
            amountClp: payoutAmount,
            status: "PENDING"
          }
        }));

      await tx.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.PAYOUT_SCHEDULED }
      });

      await tx.notification.create({
        data: {
          userId: booking.proId!,
          bookingId: booking.id,
          title: "Cliente confirmó el servicio",
          body: "El pago quedó programado para el próximo ciclo automático de WeTask."
        }
      });

      await tx.notification.create({
        data: {
          userId: booking.customerId,
          bookingId: booking.id,
          title: "Servicio confirmado",
          body: "Gracias por confirmar. El pago del profesional quedó programado."
        }
      });

      return { payout };
    });

    return NextResponse.json({ ok: true, payout: result.payout, booking }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo confirmar el servicio",
        detail: safeErrorDetail(error)
      },
      { status: 400 }
    );
  }
}
