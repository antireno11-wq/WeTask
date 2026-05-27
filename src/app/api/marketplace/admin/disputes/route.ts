import { UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestIdentity, hasRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { refundProviderPayment } from "@/lib/payments/provider-adapter";

const resolveSchema = z.object({
  disputeId: z.string().min(1),
  status: z.enum(["OPEN", "IN_REVIEW", "RESOLVED", "CLOSED"]),
  resolution: z.string().max(1000).optional(),
  refundAmountClp: z.number().int().min(0).optional()
});

export async function GET(req: NextRequest) {
  try {
    const identity = getRequestIdentity(req);
    if (!hasRole(identity.role, UserRole.ADMIN)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const disputes = await prisma.disputeTicket.findMany({
      orderBy: [{ createdAt: "desc" }],
      include: {
        booking: {
          select: {
            id: true,
            status: true,
            paymentStatus: true,
            customer: { select: { fullName: true, email: true } },
            pro: { select: { fullName: true, email: true } }
          }
        }
      }
    });

    return NextResponse.json({ disputes }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudieron listar disputas",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const identity = getRequestIdentity(req);
    if (!hasRole(identity.role, UserRole.ADMIN)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await req.json();
    const input = resolveSchema.parse(body);

    const dispute = await prisma.disputeTicket.findUnique({ where: { id: input.disputeId } });
    if (!dispute) return NextResponse.json({ error: "Disputa no encontrada" }, { status: 404 });

    const updated = await prisma.disputeTicket.update({
      where: { id: dispute.id },
      data: {
        status: input.status,
        resolution: input.resolution,
        refundAmountClp: input.refundAmountClp
      },
      include: { booking: true }
    });

    if (input.status === "RESOLVED" && typeof input.refundAmountClp === "number" && input.refundAmountClp > 0) {
      const payment = await prisma.payment.findUnique({
        where: { bookingId: dispute.bookingId }
      });

      if (payment && payment.providerPaymentId && !payment.providerPaymentId.startsWith("sim_")) {
        try {
          const refundResult = await refundProviderPayment(payment.provider as any, {
            providerPaymentId: payment.providerPaymentId,
            amount: input.refundAmountClp
          });
          if (refundResult.status !== "refunded") {
            throw new Error(refundResult.errorMessage || "La pasarela de pago rechazó el reembolso");
          }
        } catch (refundError) {
          return NextResponse.json(
            {
              error: "No se pudo procesar el reembolso en Mercado Pago",
              detail: refundError instanceof Error ? refundError.message : "Error de comunicación"
            },
            { status: 502 }
          );
        }
      }

      await prisma.booking.update({
        where: { id: dispute.bookingId },
        data: {
          status: "REFUNDED",
          paymentStatus: "PARTIAL_REFUNDED"
        }
      });

      await prisma.payment.updateMany({
        where: { bookingId: dispute.bookingId },
        data: { status: "PARTIAL_REFUNDED" }
      });

      // Free slot if booking is refunded
      const booking = await prisma.booking.findUnique({
        where: { id: dispute.bookingId },
        select: { bookedSlotId: true }
      });
      if (booking?.bookedSlotId) {
        await prisma.availabilitySlot.updateMany({
          where: { id: booking.bookedSlotId },
          data: { isAvailable: true }
        });
      }
    }

    return NextResponse.json({ dispute: updated }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo actualizar disputa",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}
