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
import { rateLimit, tooManyRequestsResponse } from "@/lib/rate-limit";

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

  // 10 refunds/h por admin — protección contra clicks accidentales o
  // admin comprometido. Es muy poco para volumen real pero suficiente
  // operacionalmente.
  const rl = await rateLimit("admin.refund", admin.identity.userId ?? "unknown", "10/h");
  if (!rl.success) return tooManyRequestsResponse(rl) as unknown as NextResponse;

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
            paymentStatus: true,
            proId: true,
            payout: { select: { status: true } }
          }
        }
      }
    });

    if (!payment) {
      return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 });
    }

    // PAY-02: guarda de idempotencia — nunca ejecutar un segundo refund sobre un pago ya reembolsado.
    if (payment.status === PaymentStatus.REFUNDED || payment.providerStatus === "refunded") {
      return NextResponse.json(
        { error: "Este pago ya fue reembolsado", paymentId: payment.id, bookingId: payment.bookingId },
        { status: 409 }
      );
    }

    if (payment.provider !== "MERCADOPAGO" || !payment.providerPaymentId) {
      return NextResponse.json({ error: "Este pago no soporta reembolso automático" }, { status: 400 });
    }

    // PAY-06: el monto del refund nunca puede superar lo cobrado.
    if (input.amount && input.amount > payment.amountClp) {
      return NextResponse.json(
        { error: `El monto excede lo cobrado (${payment.amountClp} CLP)` },
        { status: 400 }
      );
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

    // PAY-03: si el escrow YA fue liberado al tasker, un refund automático a MP haría que la
    // plataforma pague de su bolsillo la parte del tasker. En ese caso NO se toca MP: se registra
    // un CLAWBACK contra el tasker (se recupera de payouts futuros) y el reembolso al cliente se
    // gestiona aparte — mismo criterio que el flujo de disputas (G4/G9).
    const escrowReleased = payment.escrowStatus === "RELEASED" || payment.booking.payout?.status === "PAID";

    if (escrowReleased) {
      if (!payment.booking.proId) {
        return NextResponse.json(
          { error: "Escrow liberado sin tasker asociado; gestionar refund manualmente" },
          { status: 409 }
        );
      }
      const refundAmount = input.amount ?? payment.amountClp;
      const proId = payment.booking.proId;
      await prisma.$transaction(async (tx) => {
        await tx.payoutClawback.create({
          data: {
            proId,
            bookingId: payment.bookingId,
            amountClp: refundAmount,
            reason: "Refund admin tras liberación del escrow",
            status: "PENDING"
          }
        });
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: PaymentStatus.REFUNDED, escrowStatus: "CONTESTED", refundedAt: new Date() }
        });
        await tx.booking.update({
          where: { id: payment.bookingId },
          data: { status: BookingStatus.REFUNDED, paymentStatus: PaymentStatus.REFUNDED }
        });
        await recordAdminAction(
          {
            actorId: admin.identity.userId,
            action: "payment.refund.clawback",
            target: { type: "Payment", id: payment.id },
            before: { bookingId: payment.bookingId, paymentStatus: payment.status, bookingStatus: payment.booking.status },
            after: { paymentStatus: PaymentStatus.REFUNDED, clawbackAmountClp: refundAmount, escrowStatus: "CONTESTED" }
          },
          tx
        );
      });
      return NextResponse.json(
        {
          ok: true,
          clawback: true,
          bookingId: payment.bookingId,
          paymentId: payment.id,
          note: "Escrow ya liberado: refund a MP omitido, se registró clawback. Gestionar reembolso al cliente aparte."
        },
        { status: 200 }
      );
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
          // PAY-12: dejar el escrow consistente tras el refund.
          escrowStatus: "REFUNDED",
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
