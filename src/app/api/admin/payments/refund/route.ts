import { PaymentStatus, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getRequestIdentity, hasRole } from "@/lib/auth";
import { refundProviderPayment } from "@/lib/payments/provider-adapter";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const refundSchema = z
  .object({
    paymentId: z.string().min(1).optional(),
    bookingId: z.string().min(1).optional(),
    amount: z.coerce.number().positive().optional()
  })
  .refine((value) => Boolean(value.paymentId || value.bookingId), {
    message: "Debes enviar paymentId o bookingId"
  });

export async function POST(req: NextRequest) {
  const identity = getRequestIdentity(req);
  if (!hasRole(identity.role, UserRole.ADMIN)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const input = refundSchema.parse(body);

    const payment = await prisma.payment.findFirst({
      where: input.paymentId ? { id: input.paymentId } : { bookingId: input.bookingId },
      include: {
        booking: {
          select: {
            id: true
          }
        }
      }
    });

    if (!payment) {
      return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 });
    }

    if (payment.provider !== "MERCADOPAGO" || !payment.providerPaymentId) {
      return NextResponse.json({ error: "Este pago no soporta reembolso automático" }, { status: 400 });
    }

    const providerResult = await refundProviderPayment("MERCADOPAGO", {
      providerPaymentId: payment.providerPaymentId,
      amount: input.amount
    });

    if (providerResult.status !== "refunded") {
      return NextResponse.json(
        {
          error: "Mercado Pago rechazó el reembolso",
          providerStatus: providerResult.providerStatus,
          detail: providerResult.errorMessage ?? providerResult.errorCode ?? "Sin detalle"
        },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.REFUNDED,
          providerStatus: "refunded",
          refundedAt: providerResult.refundedAt ?? new Date(),
          rawResponseJson: providerResult.raw as any
        }
      });

      await tx.booking.update({
        where: { id: payment.bookingId },
        data: {
          status: "REFUNDED",
          paymentStatus: PaymentStatus.REFUNDED
        }
      });
    });

    return NextResponse.json({ ok: true, bookingId: payment.bookingId, paymentId: payment.id }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "No se pudo reembolsar el pago",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}
