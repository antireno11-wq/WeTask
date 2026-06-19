import { PaymentStatus } from "@prisma/client";

/**
 * Lógica pura de reembolsos (PAY-06). Centraliza la regla anti-sobre-reembolso
 * usada por el route admin de refunds y por la resolución de disputas, para que
 * la invariante "la suma de refunds nunca supera lo cobrado" sea única y testeable.
 */
export type RefundComputation =
  | {
      ok: true;
      /** Monto a reembolsar en esta operación. */
      refundAmountClp: number;
      /** Total acumulado tras esta operación (previo + actual). */
      cumulativeRefundedClp: number;
      /** Si con esta operación el pago queda totalmente reembolsado. */
      isFullRefund: boolean;
      /** Estado de pago resultante. */
      nextPaymentStatus: typeof PaymentStatus.REFUNDED | typeof PaymentStatus.PARTIAL_REFUNDED;
    }
  | {
      ok: false;
      reason: "fully_refunded" | "exceeds_remaining" | "invalid_amount";
      /** Saldo aún reembolsable. */
      remainingClp: number;
    };

/**
 * @param amountChargedClp  Monto total cobrado al cliente.
 * @param alreadyRefundedClp  Suma de refunds previos (Payment.refundedAmountClp).
 * @param requestedClp  Monto pedido. `undefined` = reembolsar todo el saldo restante.
 */
export function computeRefund(
  amountChargedClp: number,
  alreadyRefundedClp: number,
  requestedClp: number | undefined
): RefundComputation {
  const charged = Math.max(0, Math.floor(amountChargedClp));
  const already = Math.max(0, Math.floor(alreadyRefundedClp));
  const remainingClp = Math.max(0, charged - already);

  if (remainingClp <= 0) {
    return { ok: false, reason: "fully_refunded", remainingClp: 0 };
  }

  // Sin monto explícito → reembolsar el saldo completo restante.
  const requested = requestedClp === undefined ? remainingClp : Math.floor(requestedClp);

  if (!Number.isFinite(requested) || requested <= 0) {
    return { ok: false, reason: "invalid_amount", remainingClp };
  }
  if (requested > remainingClp) {
    return { ok: false, reason: "exceeds_remaining", remainingClp };
  }

  const cumulativeRefundedClp = already + requested;
  const isFullRefund = cumulativeRefundedClp >= charged;

  return {
    ok: true,
    refundAmountClp: requested,
    cumulativeRefundedClp,
    isFullRefund,
    nextPaymentStatus: isFullRefund ? PaymentStatus.REFUNDED : PaymentStatus.PARTIAL_REFUNDED
  };
}
