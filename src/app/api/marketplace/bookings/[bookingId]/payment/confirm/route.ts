import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getRequestIdentity, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, context: { params: { bookingId: string } }) {
  try {
    const identity = getRequestIdentity(req);
    if (!hasRole(identity.role, [UserRole.CUSTOMER, UserRole.ADMIN])) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: context.params.bookingId },
      include: { payment: true, pro: true, customer: true }
    });
    if (!booking) return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });

    if (identity.role === UserRole.CUSTOMER && identity.userId !== booking.customerId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    if (booking.paymentStatus === "PAID") {
      return NextResponse.json({ booking }, { status: 200 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (booking.bookedSlotId) {
        const lockResult = await tx.availabilitySlot.updateMany({
          where: { id: booking.bookedSlotId, isAvailable: true },
          data: { isAvailable: false }
        });

        if (lockResult.count === 0) {
          throw new Error("El horario ya fue reservado por otro usuario");
        }
      }

      const updatedBooking = await tx.booking.update({
        where: { id: booking.id },
        data: {
          paymentStatus: "PAID",
          status: booking.proId ? "CONFIRMED" : "PENDING",
          payment: booking.payment
            ? {
                update: {
                  status: "PAID",
                  paidAt: new Date(),
                  providerPaymentId: booking.payment.providerPaymentId ?? `sim_${booking.id}`
                }
              }
            : {
                create: {
                  provider: "STRIPE",
                  amountClp: booking.totalPriceClp,
                  platformFeeClp: booking.platformFeeClp,
                  status: "PAID",
                  paidAt: new Date(),
                  providerPaymentId: `sim_${booking.id}`
                }
              }
        },
        include: { payment: true }
      });

      await tx.notification.create({
        data: {
          userId: booking.customerId,
          bookingId: booking.id,
          title: "Reserva confirmada",
          body: `Tu reserva ${booking.id} quedó confirmada y pagada.`
        }
      });

      if (booking.proId) {
        await tx.notification.create({
          data: {
            userId: booking.proId,
            bookingId: booking.id,
            title: "Nueva reserva asignada",
            body: `Tienes una nueva reserva pagada para ${booking.customer.fullName}.`
          }
        });
      }

      return updatedBooking;
    });

    return NextResponse.json({ booking: updated }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo confirmar pago",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}
