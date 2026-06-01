import { createHmac, timingSafeEqual } from "crypto";
import { safeErrorDetail } from "@/lib/logger";
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
import { getMercadoPagoMarketplacePayment } from "@/lib/payments/providers/mercadopago";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/token-encryption";

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

    // PAY-05: sólo procesamos notificaciones de pagos. Otros topics (merchant_order,
    // plan, subscription, etc.) se ignoran para no tratar su id como un payment id.
    const topic =
      req.nextUrl.searchParams.get("type") ??
      req.nextUrl.searchParams.get("topic") ??
      (typeof body?.type === "string" ? body.type : null);
    if (topic && topic !== "payment") {
      return NextResponse.json({ ok: true, ignored: true, reason: "non_payment_topic", topic }, { status: 200 });
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

    if (verification === "unverifiable" && process.env.NODE_ENV !== "development" && process.env.NODE_ENV !== "test") {
      // PAY-05: fuera de development/test exigimos el secret configurado para no aceptar
      // webhooks arbitrarios (un NODE_ENV mal seteado ya no abre el webhook).
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

    // Fast-path de idempotencia: si YA procesamos este evento, salimos sin
    // llamar a MP ni tocar nada. El marcador autoritativo se inserta DENTRO de
    // la transacción de abajo (G3), para que marcador y mutación commiteen o
    // reviertan juntos. Así, si la tx falla, el reintento de MP NO se descarta
    // como "duplicado" y el pago no queda congelado.
    const alreadyProcessed = await prisma.processedWebhookEvent.findUnique({
      where: { provider_eventId: { provider: "MERCADOPAGO", eventId } }
    });
    if (alreadyProcessed) {
      return NextResponse.json({ ok: true, duplicate: true }, { status: 200 });
    }

    // PAY-01: en el modelo marketplace, el payment.id pertenece a la cuenta del COLLECTOR
    // (tasker), no a la plataforma. Resolvemos primero el Payment local para obtener el token
    // del collector y consultamos a MP con ESE token. Sólo si no lo encontramos por
    // providerPaymentId caemos al token de plataforma para recuperar el external_reference.
    const bookingInclude = {
      booking: {
        select: {
          id: true,
          bookedSlotId: true,
          status: true,
          pro: { select: { mpAccessToken: true } }
        }
      }
    } as const;

    let payment = await prisma.payment.findFirst({
      where: { provider: "MERCADOPAGO", providerPaymentId },
      include: bookingInclude
    });

    const collectorToken = decryptSecret(payment?.booking?.pro?.mpAccessToken);
    const providerResult = collectorToken
      ? await getMercadoPagoMarketplacePayment(providerPaymentId, collectorToken)
      : await getProviderPayment("MERCADOPAGO", providerPaymentId);

    if (!payment) {
      const externalReference =
        (providerResult.raw as any)?.external_reference ??
        (providerResult.raw as any)?.metadata?.booking_id ??
        null;
      if (externalReference) {
        payment = await prisma.payment.findFirst({
          where: { provider: "MERCADOPAGO", bookingId: String(externalReference) },
          include: bookingInclude
        });
      }
    }

    if (!payment) {
      return NextResponse.json({ ok: true, ignored: true, reason: "payment_not_found" }, { status: 200 });
    }

    const nextState = stateFromProviderStatus(providerResult.status);

    // Validar transición. Si no es válida (e.g. webhook tardío con `approved`
    // sobre booking ya COMPLETED), saltamos el booking update pero seguimos
    // sincronizando el Payment.
    const transitionAllowed = canTransition(payment.booking.status, nextState.bookingStatus, "SYSTEM");

    try {
      await prisma.$transaction(async (tx) => {
        // Marcador de idempotencia DENTRO de la tx (G3): si la mutación falla,
        // este insert se revierte y MP puede reintentar. El unique constraint
        // (provider, eventId) protege contra dos webhooks concurrentes.
        await tx.processedWebhookEvent.create({
          data: {
            provider: "MERCADOPAGO",
            eventId,
            payloadJson: body && Object.keys(body).length > 0 ? (body as Prisma.InputJsonValue) : Prisma.JsonNull
          }
        });

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
    } catch (err) {
      // Webhook concurrente ganó la carrera del unique constraint = duplicado real.
      if (err && typeof err === "object" && (err as { code?: string }).code === "P2002") {
        return NextResponse.json({ ok: true, duplicate: true }, { status: 200 });
      }
      throw err; // otro error → 500, marcador revertido, MP reintenta
    }

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
        detail: safeErrorDetail(error)
      },
      { status: 500 }
    );
  }
}
