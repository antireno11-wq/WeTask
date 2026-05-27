import { createHmac, timingSafeEqual } from "crypto";
import { BookingStatus, PaymentStatus, Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { emitBoletaForPaymentIfNeeded } from "@/lib/billing/boleta-hook";
import { sendBookingStatusEmailToCustomer } from "@/lib/booking-status-email";
import {
  assertTransition,
  canTransition,
  InvalidBookingTransitionError
} from "@/lib/booking-state-machine";
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
  if (status === "approved") return { bookingStatus: BookingStatus.CONFIRMED, paymentStatus: PaymentStatus.PAID };
  if (status === "refunded") return { bookingStatus: BookingStatus.REFUNDED, paymentStatus: PaymentStatus.REFUNDED };
  if (status === "pending") return { bookingStatus: BookingStatus.PENDING_PAYMENT, paymentStatus: PaymentStatus.PENDING };
  return { bookingStatus: BookingStatus.PAYMENT_FAILED, paymentStatus: PaymentStatus.FAILED };
}

/**
 * Verifica la firma `x-signature` de MercadoPago.
 * Formato esperado en el header:
 *   ts=<timestamp>,v1=<hex_signature>
 * Manifest a firmar:
 *   id:<data.id>;request-id:<x-request-id>;ts:<ts>;
 *
 * Si no hay `MERCADOPAGO_WEBHOOK_SECRET` configurado, retorna `null` para
 * indicar "no verificable" — el caller decide rechazar (en producción) o
 * dejar pasar (dev). Si hay secret y la firma no cuadra, retorna `false`.
 */
function verifyMercadoPagoSignature(input: {
  signatureHeader: string | null;
  requestIdHeader: string | null;
  dataId: string;
}): "valid" | "invalid" | "unverifiable" {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) return "unverifiable";
  if (!input.signatureHeader || !input.requestIdHeader) return "invalid";

  const parts = input.signatureHeader.split(",").map((p) => p.trim());
  const ts = parts.find((p) => p.startsWith("ts="))?.slice(3);
  const v1 = parts.find((p) => p.startsWith("v1="))?.slice(3);
  if (!ts || !v1) return "invalid";

  const manifest = `id:${input.dataId};request-id:${input.requestIdHeader};ts:${ts};`;
  const expectedHex = createHmac("sha256", secret).update(manifest).digest("hex");

  try {
    const a = Buffer.from(expectedHex, "hex");
    const b = Buffer.from(v1, "hex");
    if (a.length !== b.length) return "invalid";
    return timingSafeEqual(a, b) ? "valid" : "invalid";
  } catch {
    return "invalid";
  }
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    let body: any = {};
    try {
      body = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      body = {};
    }

    const providerPaymentId = resolveProviderPaymentId(req, body);
    if (!providerPaymentId) {
      return NextResponse.json({ ok: true, ignored: true, reason: "missing_payment_id" }, { status: 200 });
    }

    const signatureHeader = req.headers.get("x-signature");
    const requestIdHeader = req.headers.get("x-request-id");
    const verification = verifyMercadoPagoSignature({
      signatureHeader,
      requestIdHeader,
      dataId: providerPaymentId
    });

    if (verification === "invalid") {
      return NextResponse.json({ error: "Firma inválida" }, { status: 401 });
    }

    if (verification === "unverifiable" && process.env.NODE_ENV === "production") {
      // En producción exigimos secret configurado para no aceptar webhooks
      // arbitrarios. En dev se permite para facilitar testing local.
      return NextResponse.json(
        { error: "MERCADOPAGO_WEBHOOK_SECRET no configurado" },
        { status: 401 }
      );
    }

    // Idempotencia: si ya procesamos este eventId, salimos sin tocar nada.
    // Como eventId usamos la combinación (data.id + x-request-id) cuando
    // está disponible; cae a (data.id + body.type + ts) o solo data.id.
    const eventId = [
      providerPaymentId,
      requestIdHeader ?? body?.type ?? body?.action ?? "noop",
      body?.date_created ?? ""
    ]
      .filter(Boolean)
      .join(":");

    try {
      await prisma.processedWebhookEvent.create({
        data: {
          provider: "MERCADOPAGO",
          eventId,
          payloadJson: body && Object.keys(body).length > 0 ? (body as Prisma.InputJsonValue) : Prisma.JsonNull
        }
      });
    } catch (err) {
      // Unique constraint violation = duplicado; respondemos 200 idempotente.
      if (err && typeof err === "object" && (err as { code?: string }).code === "P2002") {
        return NextResponse.json({ ok: true, duplicate: true }, { status: 200 });
      }
      throw err;
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
            bookedSlotId: true,
            status: true
          }
        }
      }
    });

    if (!payment) {
      return NextResponse.json({ ok: true, ignored: true, reason: "payment_not_found" }, { status: 200 });
    }

    const nextState = stateFromProviderStatus(providerResult.status);

    // Validar transición. Si no es válida (e.g. webhook tardío con `approved`
    // sobre booking ya COMPLETED), saltamos el booking update pero seguimos
    // sincronizando el Payment.
    const transitionAllowed = canTransition(payment.booking.status, nextState.bookingStatus, "SYSTEM");

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

      if (transitionAllowed) {
        await tx.booking.update({
          where: { id: payment.bookingId },
          data: {
            status: nextState.bookingStatus,
            paymentStatus: nextState.paymentStatus
          }
        });
      } else {
        // Solo sincronizamos paymentStatus si la transición de status no aplica.
        await tx.booking.update({
          where: { id: payment.bookingId },
          data: { paymentStatus: nextState.paymentStatus }
        });
      }

      if (nextState.bookingStatus === BookingStatus.PAYMENT_FAILED && payment.booking.bookedSlotId && transitionAllowed) {
        await tx.availabilitySlot.updateMany({
          where: { id: payment.booking.bookedSlotId },
          data: { isAvailable: true }
        });
      }
    });

    if (transitionAllowed) {
      void sendBookingStatusEmailToCustomer({
        bookingId: payment.booking.id,
        previousStatus: payment.booking.status,
        nextStatus: nextState.bookingStatus
      });
    }

    if (nextState.paymentStatus === PaymentStatus.PAID) {
      void emitBoletaForPaymentIfNeeded(payment.id);
    }

    return NextResponse.json(
      {
        ok: true,
        transitionApplied: transitionAllowed,
        eventId
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof InvalidBookingTransitionError) {
      // No debería pasar (usamos canTransition antes) pero por seguridad.
      return NextResponse.json({ ok: true, ignored: true, reason: "invalid_transition" }, { status: 200 });
    }
    return NextResponse.json(
      {
        ok: false,
        error: "Webhook Mercado Pago falló",
        detail: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 500 }
    );
  }
}
