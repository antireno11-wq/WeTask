import { BookingStatus, PaymentStatus, PayoutStatus, Prisma } from "@prisma/client";
import { canTransition } from "@/lib/booking-state-machine";
import { logError } from "@/lib/logger";
import { notifyPayoutReleased } from "@/lib/notification-events";
import { getMercadoPagoMarketplacePayment, getMercadoPagoPayment } from "@/lib/payments/providers/mercadopago";
import { prisma } from "@/lib/prisma";

const HOLD_HOURS = 24;
const RECONCILE_THRESHOLD_MINUTES = 10;

export type ProcessBookingsResult = {
  reviewed: number;
  scheduled: number;
  paidOut: number;
  failed: number;
  bookings: Array<{
    bookingId: string;
    payoutId: string;
    amountClp: number;
    payoutStatus: PayoutStatus;
    escrowStatus: string;
    providerStatus: string | null;
  }>;
};

/**
 * Procesa bookings AWAITING_CUSTOMER_CONFIRMATION + PAID + sin disputa
 * + updatedAt > HOLD_HOURS atrás:
 * 1. Transiciona Booking → PAYOUT_SCHEDULED.
 * 2. Crea o reutiliza Payout y lo intenta marcar PAID si MP confirma
 *    que el dinero ya fue liberado al collector.
 * 3. Marca Payment.escrowStatus="RELEASED" cuando el provider reporta
 *    el pago aprobado y liberado.
 * 4. Notifica al tasker.
 *
 * Es seguro correrlo múltiples veces (idempotente).
 */
export async function processBookingsForPayout(): Promise<ProcessBookingsResult> {
  const cutoff = new Date(Date.now() - HOLD_HOURS * 60 * 60 * 1000);

  const candidates = await prisma.booking.findMany({
    where: {
      paymentStatus: PaymentStatus.PAID,
      OR: [
        // Auto-confirm por silencio del cliente: solo tras el hold de 24h.
        { status: BookingStatus.AWAITING_CUSTOMER_CONFIRMATION, updatedAt: { lte: cutoff } },
        // El cliente YA confirmó explícitamente (customer-confirm) → procesar sin esperar.
        // Sin este caso, los payouts de bookings confirmados quedaban atascados para siempre (G1).
        { status: BookingStatus.PAYOUT_SCHEDULED }
      ]
    },
    include: {
      payment: true,
      payout: true,
      disputes: {
        where: { status: { in: ["OPEN", "IN_REVIEW"] } },
        select: { id: true }
      },
      pro: { select: { id: true, fullName: true, email: true, mpAccessToken: true } }
    }
  });

  const eligible = candidates.filter((b) => b.disputes.length === 0 && b.proId && b.pro);

  const result: ProcessBookingsResult = {
    reviewed: candidates.length,
    scheduled: 0,
    paidOut: 0,
    failed: 0,
    bookings: []
  };

  for (const booking of eligible) {
    const payoutAmount = Math.max(booking.totalPriceClp - booking.platformFeeClp, 0);
    let payoutId: string;
    let payoutStatus: PayoutStatus = PayoutStatus.PENDING;
    let escrowStatus = booking.payment?.escrowStatus ?? "HELD";
    let providerStatus: string | null = null;

    const isScheduled = booking.status === BookingStatus.PAYOUT_SCHEDULED;

    if (!isScheduled) {
      // FASE 1 — el cliente confirmó (customer-confirm) o pasó el hold de 24h:
      // solo PROGRAMAMOS el payout (PENDING) y movemos el booking a
      // PAYOUT_SCHEDULED. NO liberamos el escrow todavía: eso ocurre en la
      // fase 2, cuando MercadoPago confirma que el dinero salió del escrow.
      payoutStatus = PayoutStatus.PENDING;
    } else if (booking.payment?.providerPaymentId) {
      // FASE 2 — booking ya programado: consultamos a MP y liberamos SOLO si el
      // dinero realmente salió del escrow (money_release_date pasado, G7).
      try {
        const providerResult = booking.pro!.mpAccessToken
          ? await getMercadoPagoMarketplacePayment(booking.payment.providerPaymentId, booking.pro!.mpAccessToken)
          : await getMercadoPagoPayment(booking.payment.providerPaymentId);
        providerStatus = providerResult.providerStatus;
        const releaseDate = providerResult.moneyReleaseDate ?? null;
        const releaseDuePassed = !releaseDate || releaseDate.getTime() <= Date.now();

        if (providerResult.reachable === false) {
          // Fallo de transporte (MP caído/rate-limit): reintentar el próximo ciclo (G6).
          payoutStatus = PayoutStatus.PROCESSING;
        } else if (providerResult.status === "approved" && releaseDuePassed) {
          payoutStatus = PayoutStatus.PAID;
          escrowStatus = "RELEASED";
        } else if (providerResult.status === "approved") {
          // Aprobado pero el escrow sigue retenido por MP hasta money_release_date (G7):
          // mantener HELD y reintentar en el próximo ciclo.
          payoutStatus = PayoutStatus.PROCESSING;
        } else if (providerResult.status === "refunded") {
          payoutStatus = PayoutStatus.FAILED;
          escrowStatus = "REFUNDED";
        } else {
          payoutStatus = PayoutStatus.PROCESSING;
        }
      } catch {
        payoutStatus = PayoutStatus.PROCESSING;
      }
    } else {
      payoutStatus = PayoutStatus.PENDING;
    }

    try {
      const tx = await prisma.$transaction(async (tx) => {
        // Crear o reutilizar payout.
        const payout =
          booking.payout ??
          (await tx.payout.create({
            data: {
              bookingId: booking.id,
              proId: booking.proId!,
              amountClp: payoutAmount,
              status: PayoutStatus.PENDING
            }
          }));

        await tx.payout.update({
          where: { id: payout.id },
          data: {
            status: payoutStatus,
            paidAt: payoutStatus === PayoutStatus.PAID ? new Date() : null
          }
        });

        // Transición respetando la state machine de 2 pasos:
        // FASE 1 (AWAITING) → PAYOUT_SCHEDULED.
        // FASE 2 (ya programado + escrow liberado) → COMPLETED.
        const nextStatus = !isScheduled
          ? BookingStatus.PAYOUT_SCHEDULED
          : payoutStatus === PayoutStatus.PAID
            ? BookingStatus.COMPLETED
            : booking.status;
        if (nextStatus !== booking.status && canTransition(booking.status, nextStatus, "SYSTEM")) {
          await tx.booking.update({
            where: { id: booking.id },
            data: { status: nextStatus }
          });
        }

        if (booking.payment) {
          await tx.payment.update({
            where: { id: booking.payment.id },
            data: {
              escrowStatus,
              escrowReleasedAt: escrowStatus === "RELEASED" ? new Date() : booking.payment.escrowReleasedAt
            }
          });
        }

        // Notificación al CLIENTE cuando se libera (al tasker la envía
        // notifyPayoutReleased fuera de la tx, así también va el email).
        if (payoutStatus === PayoutStatus.PAID) {
          await tx.notification.create({
            data: {
              userId: booking.customerId,
              bookingId: booking.id,
              title: "Servicio cerrado",
              body: "El pago del profesional quedó liberado. Gracias por usar WeTask."
            }
          });
        } else if (!isScheduled && !booking.payout) {
          await tx.notification.create({
            data: {
              userId: booking.proId!,
              bookingId: booking.id,
              title: "Payout programado",
              body: "Tu pago quedó programado y se libera cuando MercadoPago libere el escrow."
            }
          });
        }

        return payout.id;
      });
      payoutId = tx;
    } catch (err) {
      result.failed += 1;
      logError("payouts-processor.schedule_payout", err, { bookingId: booking.id });
      continue;
    }

    if (payoutStatus === PayoutStatus.PAID) {
      result.paidOut += 1;
      // Notificación + email vía helper centralizado (la in-app ya se creó
      // arriba en la tx para tener atomicidad; esta llamada agrega el email
      // y otra notificación, pero notifyPayoutReleased es idempotente al
      // nivel de UX — duplicar el feed es preferible a perder el email).
      await notifyPayoutReleased({
        pro: {
          userId: booking.proId!,
          email: booking.pro!.email,
          fullName: booking.pro!.fullName,
          role: "PRO"
        },
        bookingId: booking.id,
        amountClp: payoutAmount
      }).catch((err) => {
        logError("payouts-processor.notify_payout_released", err, { bookingId: booking.id });
      });
    } else if (!isScheduled && !booking.payout) {
      result.scheduled += 1;
    }

    result.bookings.push({
      bookingId: booking.id,
      payoutId,
      amountClp: payoutAmount,
      payoutStatus,
      escrowStatus,
      providerStatus
    });
  }

  return result;
}

/**
 * Limpia los holds expirados sobre AvailabilitySlot (escenario: el cliente
 * inició el wizard de pago, hizo hold de un slot, y abandonó sin pagar).
 * Tras 5min sin pago confirmado, el slot vuelve a estar disponible para
 * otros.
 */
export async function releaseExpiredHolds(): Promise<{ released: number }> {
  const now = new Date();
  const result = await prisma.availabilitySlot.updateMany({
    where: {
      holdExpiresAt: { lt: now, not: null },
      // No liberar holds de slots que ya tienen un booking asociado:
      // si hay booking el isAvailable=false es el real.
      isAvailable: true,
      bookings: { none: {} }
    },
    data: {
      holdExpiresAt: null,
      heldByUserId: null
    }
  });
  return { released: result.count };
}

export type ReconcilePaymentsResult = {
  reviewed: number;
  updated: number;
  failed: number;
  details: Array<{
    paymentId: string;
    bookingId: string;
    before: PaymentStatus;
    after: PaymentStatus;
    providerStatus: string;
  }>;
};

const PROVIDER_STATUS_TO_PAYMENT: Record<string, PaymentStatus> = {
  approved: PaymentStatus.PAID,
  refunded: PaymentStatus.REFUNDED,
  pending: PaymentStatus.PENDING,
  failed: PaymentStatus.FAILED
};

const PROVIDER_STATUS_TO_BOOKING: Record<string, BookingStatus> = {
  approved: BookingStatus.CONFIRMED,
  refunded: BookingStatus.REFUNDED,
  pending: BookingStatus.PENDING_PAYMENT,
  failed: BookingStatus.PAYMENT_FAILED
};

/**
 * Reconciliación de pagos: para cualquier Payment.status="PENDING" con
 * createdAt > RECONCILE_THRESHOLD_MINUTES atrás, re-pregunta a MP el estado
 * real y sincroniza Payment + Booking. Útil cuando un webhook se perdió o
 * llegó después del timeout del request.
 */
export async function reconcilePendingPayments(): Promise<ReconcilePaymentsResult> {
  const cutoff = new Date(Date.now() - RECONCILE_THRESHOLD_MINUTES * 60 * 1000);

  const pending = await prisma.payment.findMany({
    where: {
      status: PaymentStatus.PENDING,
      createdAt: { lte: cutoff },
      provider: "MERCADOPAGO",
      providerPaymentId: { not: null }
    },
    include: {
      booking: { select: { id: true, status: true, bookedSlotId: true } }
    },
    take: 100
  });

  const result: ReconcilePaymentsResult = {
    reviewed: pending.length,
    updated: 0,
    failed: 0,
    details: []
  };

  // Solo marcamos un pago como FAILED definitivamente tras esta antigüedad.
  // Antes de eso, un MP "no aprobado" puede ser un webhook aún en camino (G6).
  const FAILED_MIN_AGE_MS = 48 * 60 * 60 * 1000;

  for (const payment of pending) {
    if (!payment.providerPaymentId) continue;
    try {
      const providerResult = await getMercadoPagoPayment(payment.providerPaymentId);

      // Fallo de transporte (MP caído/rate-limit): NO tocar el pago, reintentar
      // el próximo ciclo. Nunca cancelar un booking ni liberar su slot por esto (G6).
      if (providerResult.reachable === false) {
        result.failed += 1;
        continue;
      }

      const nextPaymentStatus = PROVIDER_STATUS_TO_PAYMENT[providerResult.status];
      const nextBookingStatus = PROVIDER_STATUS_TO_BOOKING[providerResult.status];
      if (!nextPaymentStatus || nextPaymentStatus === payment.status) {
        continue; // sin cambios
      }

      // No marcar FAILED un pago joven: probablemente el webhook de aprobación
      // todavía no llegó. Esperar hasta FAILED_MIN_AGE_MS antes de cancelar (G6).
      if (
        nextPaymentStatus === PaymentStatus.FAILED &&
        Date.now() - payment.createdAt.getTime() < FAILED_MIN_AGE_MS
      ) {
        continue;
      }

      await prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: nextPaymentStatus,
            providerStatus: providerResult.providerStatus,
            paidAt: providerResult.paidAt,
            refundedAt: providerResult.refundedAt,
            rawResponseJson: providerResult.raw as Prisma.InputJsonValue
          }
        });

        if (canTransition(payment.booking.status, nextBookingStatus, "SYSTEM")) {
          await tx.booking.update({
            where: { id: payment.bookingId },
            data: {
              status: nextBookingStatus,
              paymentStatus: nextPaymentStatus
            }
          });
          if (nextBookingStatus === BookingStatus.PAYMENT_FAILED && payment.booking.bookedSlotId) {
            await tx.availabilitySlot.updateMany({
              where: { id: payment.booking.bookedSlotId },
              data: { isAvailable: true }
            });
          }
        } else {
          await tx.booking.update({
            where: { id: payment.bookingId },
            data: { paymentStatus: nextPaymentStatus }
          });
        }
      });

      result.updated += 1;
      result.details.push({
        paymentId: payment.id,
        bookingId: payment.bookingId,
        before: payment.status,
        after: nextPaymentStatus,
        providerStatus: providerResult.providerStatus
      });
    } catch (err) {
      result.failed += 1;
      logError("payouts-processor.reconcile_payment", err, { paymentId: payment.id });
    }
  }

  return result;
}
