import { BookingStatus, PaymentStatus, UserRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getProviderPayment } from "@/lib/payments/provider-adapter";
import { prisma } from "@/lib/prisma";
import { sendBookingStatusEmailToCustomer } from "@/lib/booking-status-email";

export const dynamic = "force-dynamic";

function paymentStateFromProviderStatus(status: "approved" | "failed" | "pending" | "refunded") {
  if (status === "approved") return { paymentStatus: PaymentStatus.PAID, bookingStatus: "CONFIRMED" as const };
  if (status === "refunded") return { paymentStatus: PaymentStatus.REFUNDED, bookingStatus: "REFUNDED" as const };
  if (status === "pending") return { paymentStatus: PaymentStatus.PENDING, bookingStatus: "PENDING_PAYMENT" as const };
  return { paymentStatus: PaymentStatus.FAILED, bookingStatus: "PAYMENT_FAILED" as const };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    
    // Mercado Pago webhook format:
    // { "type": "payment", "action": "payment.created"/"payment.updated", "data": { "id": "payment_id" } }
    const type = body.type || body.topic;
    const paymentId = body.data?.id || body.id;

    if (type !== "payment" || !paymentId) {
      // Return 200 to acknowledge receipt of non-payment notifications (e.g. test webhooks)
      return NextResponse.json({ ok: true, message: "Notificación ignorada (no es tipo payment)" }, { status: 200 });
    }

    console.info(`[webhook] Recibida notificación de pago ID: ${paymentId}`);

    // Fetch the payment status directly from Mercado Pago using our private credentials (prevents spoofing)
    const providerResult = await getProviderPayment("MERCADOPAGO", String(paymentId));
    if (!providerResult || !providerResult.providerPaymentId) {
      return NextResponse.json({ error: "No se pudo recuperar el detalle del pago del proveedor" }, { status: 400 });
    }

    const bookingId = (providerResult.raw as any)?.external_reference || (providerResult.raw as any)?.metadata?.booking_id;
    if (!bookingId) {
      return NextResponse.json({ error: "Falta external_reference / booking_id en el pago" }, { status: 400 });
    }

    // Find the booking in the database
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { payment: true, customer: true, pro: true, service: true }
    });

    if (!booking) {
      return NextResponse.json({ error: `Reserva ${bookingId} no encontrada` }, { status: 404 });
    }

    const nextState = paymentStateFromProviderStatus(providerResult.status);

    // If the booking is already in the target state, do nothing (idempotency)
    if (booking.paymentStatus === nextState.paymentStatus && booking.status === nextState.bookingStatus) {
      return NextResponse.json({ ok: true, message: "Estado de reserva ya actualizado", idempotent: true }, { status: 200 });
    }

    const previousStatus = booking.status;

    await prisma.$transaction(async (tx) => {
      // Update or create payment record
      await tx.payment.upsert({
        where: { bookingId: booking.id },
        update: {
          providerPaymentId: providerResult.providerPaymentId!,
          providerStatus: providerResult.providerStatus,
          status: nextState.paymentStatus,
          paidAt: providerResult.paidAt,
          refundedAt: providerResult.refundedAt,
          paymentMethod: providerResult.paymentMethod || booking.payment?.paymentMethod,
          last4: providerResult.last4 || booking.payment?.last4,
          rawResponseJson: providerResult.raw as any,
          errorCode: providerResult.errorCode,
          errorMessage: providerResult.errorMessage
        },
        create: {
          bookingId: booking.id,
          provider: "MERCADOPAGO",
          providerPaymentId: providerResult.providerPaymentId!,
          providerStatus: providerResult.providerStatus,
          amountClp: providerResult.amount,
          platformFeeClp: booking.platformFeeClp,
          status: nextState.paymentStatus,
          paidAt: providerResult.paidAt,
          refundedAt: providerResult.refundedAt,
          currency: "CLP",
          paymentMethod: providerResult.paymentMethod,
          last4: providerResult.last4,
          rawResponseJson: providerResult.raw as any
        }
      });

      // Determine final booking status
      // If payment is approved and pro is assigned: CONFIRMED. If no pro: PENDING.
      let finalBookingStatus: BookingStatus = nextState.bookingStatus;
      if (nextState.bookingStatus === "CONFIRMED" && !booking.proId) {
        finalBookingStatus = "PENDING";
      }

      await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: finalBookingStatus,
          paymentStatus: nextState.paymentStatus
        }
      });

      // Free slot if payment failed or was refunded
      if ((nextState.bookingStatus === "PAYMENT_FAILED" || nextState.bookingStatus === "REFUNDED") && booking.bookedSlotId) {
        await tx.availabilitySlot.updateMany({
          where: { id: booking.bookedSlotId },
          data: { isAvailable: true }
        });
      }

      // Add notifications
      if (nextState.paymentStatus === PaymentStatus.PAID) {
        await tx.notification.create({
          data: {
            userId: booking.customerId,
            bookingId: booking.id,
            title: "Pago aprobado",
            body: `Tu reserva ${booking.id} quedó confirmada.`
          }
        });
        if (booking.proId) {
          await tx.notification.create({
            data: {
              userId: booking.proId,
              bookingId: booking.id,
              title: "Nueva reserva pagada",
              body: `Se confirmó una nueva reserva para ${booking.service.name}.`
            }
          });
        }
      }
    });

    // Send transactional status update email
    void sendBookingStatusEmailToCustomer({
      bookingId: booking.id,
      previousStatus: previousStatus,
      nextStatus: nextState.bookingStatus === "CONFIRMED" && !booking.proId ? "PENDING" : nextState.bookingStatus
    });

    return NextResponse.json({ ok: true, bookingId: booking.id, status: nextState.bookingStatus }, { status: 200 });
  } catch (error) {
    console.error("[webhook-error]", error);
    return NextResponse.json(
      {
        error: "Error al procesar webhook de pagos",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 500 }
    );
  }
}
