import { BookingStatus, PaymentStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminRequest } from "@/lib/admin-access";
import { recordAdminAction } from "@/lib/audit-log";
import {
  assertTransition,
  InvalidBookingTransitionError
} from "@/lib/booking-state-machine";
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
  const admin = await requireAdminRequest(req);
  if (!admin.ok) return admin.response;

  try {
    const body = await req.json();
    const input = refundSchema.parse(body);

    const payment = await prisma.payment.findFirst({
      where: input.paymentId ? { id: input.paymentId } : { bookingId: input.bookingId },
      include: {
        booking: {
          select: {
            id: true,
            status: true,
            paymentStatus: true
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

    try {
      assertTransition(payment.booking.status, BookingStatus.REFUNDED, "ADMIN");
    } catch (transitionError) {
      if (transitionError instanceof InvalidBookingTransitionError) {
        return NextResponse.json(
          {
            error: `No se permite refund desde el estado ${transitionError.from}`,
            from: transitionError.from
          },
          { status: 409 }
        );
      }
      throw transitionError;
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
          status: BookingStatus.REFUNDED,
          paymentStatus: PaymentStatus.REFUNDED
        }
      });

      await recordAdminAction(
        {
          actorId: admin.identity.userId,
          action: "payment.refund",
          target: { type: "Payment", id: payment.id },
          before: {
            bookingId: payment.bookingId,
            paymentStatus: payment.status,
            bookingStatus: payment.booking.status
          },
          after: {
            paymentStatus: PaymentStatus.REFUNDED,
            bookingStatus: BookingStatus.REFUNDED,
            providerStatus: "refunded",
            refundAmountClp: input.amount ?? null
          }
        },
        tx
      );
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
