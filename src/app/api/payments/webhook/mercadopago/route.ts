import { PaymentStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getProviderPayment } from "@/lib/payments/provider-adapter";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function resolveProviderPaymentId(req: NextRequest, body: any) {
  const fromQuery = req.nextUrl.searchParams.get("data.id") ?? req.nextUrl.searchParams.get("id");
  if (fromQuery) return String(fromQuery);
  const fromBody = body?.data?.id ?? body?.id;
  if (fromBody == null) return null;
  return String(fromBody);
}

function stateFromProviderStatus(status: "approved" | "failed" | "pending" | "refunded") {
  if (status === "approved") return { bookingStatus: "CONFIRMED" as const, paymentStatus: PaymentStatus.PAID };
  if (status === "refunded") return { bookingStatus: "REFUNDED" as const, paymentStatus: PaymentStatus.REFUNDED };
  if (status === "pending") return { bookingStatus: "PENDING_PAYMENT" as const, paymentStatus: PaymentStatus.PENDING };
  return { bookingStatus: "PAYMENT_FAILED" as const, paymentStatus: PaymentStatus.FAILED };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const providerPaymentId = resolveProviderPaymentId(req, body);
    if (!providerPaymentId) {
      return NextResponse.json({ ok: true, ignored: true, reason: "missing_payment_id" }, { status: 200 });
    }

    const providerResult = await getProviderPayment("MERCADOPAGO", providerPaymentId);
    const externalReference =
      (providerResult.raw as any)?.external_reference ??
      (providerResult.raw as any)?.metadata?.booking_id ??
      null;

    const payment = await prisma.payment.findFirst({
      where: {
        provider: "MERCADOPAGO",
        OR: [{ providerPaymentId }, externalReference ? { bookingId: String(externalReference) } : undefined].filter(Boolean) as any
      },
      include: {
        booking: {
          select: {
            id: true,
            bookedSlotId: true
          }
        }
      }
    });

    if (!payment) {
      return NextResponse.json({ ok: true, ignored: true, reason: "payment_not_found" }, { status: 200 });
    }

    const nextState = stateFromProviderStatus(providerResult.status);

    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          providerPaymentId: providerResult.providerPaymentId ?? providerPaymentId,
          providerStatus: providerResult.providerStatus,
          status: nextState.paymentStatus,
          paidAt: providerResult.paidAt,
          refundedAt: providerResult.refundedAt,
          paymentMethod: providerResult.paymentMethod ?? payment.paymentMethod,
          last4: providerResult.last4 ?? payment.last4,
          rawResponseJson: providerResult.raw as any,
          errorCode: providerResult.errorCode ?? null,
          errorMessage: providerResult.errorMessage ?? null
        }
      });

      await tx.booking.update({
        where: { id: payment.bookingId },
        data: {
          status: nextState.bookingStatus,
          paymentStatus: nextState.paymentStatus
        }
      });

      if (nextState.bookingStatus === "PAYMENT_FAILED" && payment.booking.bookedSlotId) {
        await tx.availabilitySlot.updateMany({
          where: { id: payment.booking.bookedSlotId },
          data: { isAvailable: true }
        });
      }
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Webhook Mercado Pago falló",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 400 }
    );
  }
}
