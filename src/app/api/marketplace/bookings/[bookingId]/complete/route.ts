import { BookingStatus, UserRole } from "@prisma/client";
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
    if (!hasRole(identity.role, [UserRole.PRO, UserRole.ADMIN])) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const booking = await prisma.booking.findUnique({ where: { id: context.params.bookingId } });
    if (!booking) return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });

    if (identity.role === UserRole.PRO && identity.userId !== booking.proId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    if (booking.paymentStatus !== "PAID") {
      return NextResponse.json({ error: "No se puede finalizar sin pago confirmado" }, { status: 400 });
    }

    // BOOK-05: no se puede cerrar un servicio sin haber registrado el check-in
    // (señal mínima de que el tasker efectivamente se presentó).
    if (!booking.checkInAt) {
      return NextResponse.json({ error: "Debes registrar el check-in antes de finalizar el servicio." }, { status: 409 });
    }

    const actor: BookingActor = identity.role === UserRole.ADMIN ? "ADMIN" : "PRO";
    try {
      assertTransition(booking.status, BookingStatus.AWAITING_CUSTOMER_CONFIRMATION, actor);
    } catch (transitionError) {
      if (transitionError instanceof InvalidBookingTransitionError) {
        return NextResponse.json(
          { error: "El estado actual de la reserva no permite finalizarla.", from: transitionError.from, to: transitionError.to },
          { status: 409 }
        );
      }
      throw transitionError;
    }

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: BookingStatus.AWAITING_CUSTOMER_CONFIRMATION,
        // Señal de finalización del tasker, anclaje para el auto-confirm (G8).
        checkOutAt: booking.checkOutAt ?? new Date()
      }
    });

    if (booking.customerId) {
      await prisma.notification.create({
        data: {
          userId: booking.customerId,
          bookingId: booking.id,
          title: "Confirma tu servicio",
          body: "El tasker marcó el trabajo como realizado. Revisa el resultado o reporta un problema antes de la liberación del pago."
        }
      });
    }

    return NextResponse.json({ booking: updated }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo finalizar reserva",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}
