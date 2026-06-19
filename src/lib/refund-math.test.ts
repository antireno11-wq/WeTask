import { describe, expect, it } from "vitest";
import { PaymentStatus } from "@prisma/client";
import { computeRefund } from "./refund-math";

describe("computeRefund (PAY-06: anti sobre-reembolso)", () => {
  it("refund total cuando no hay refunds previos y no se pasa monto", () => {
    const r = computeRefund(10000, 0, undefined);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.refundAmountClp).toBe(10000);
    expect(r.cumulativeRefundedClp).toBe(10000);
    expect(r.isFullRefund).toBe(true);
    expect(r.nextPaymentStatus).toBe(PaymentStatus.REFUNDED);
  });

  it("refund parcial deja PARTIAL_REFUNDED", () => {
    const r = computeRefund(10000, 0, 3000);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.refundAmountClp).toBe(3000);
    expect(r.cumulativeRefundedClp).toBe(3000);
    expect(r.isFullRefund).toBe(false);
    expect(r.nextPaymentStatus).toBe(PaymentStatus.PARTIAL_REFUNDED);
  });

  it("segundo parcial que completa el total → REFUNDED", () => {
    const r = computeRefund(10000, 7000, 3000);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.cumulativeRefundedClp).toBe(10000);
    expect(r.isFullRefund).toBe(true);
    expect(r.nextPaymentStatus).toBe(PaymentStatus.REFUNDED);
  });

  it("NO permite apilar parciales que superen lo cobrado (el bug PAY-06)", () => {
    // Ya se reembolsó 8000 de 10000; pedir otros 8000 debe rechazarse.
    const r = computeRefund(10000, 8000, 8000);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("exceeds_remaining");
    expect(r.remainingClp).toBe(2000);
  });

  it("rechaza si ya está totalmente reembolsado", () => {
    const r = computeRefund(10000, 10000, 1000);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe("fully_refunded");
    expect(r.remainingClp).toBe(0);
  });

  it("monto exacto al saldo restante → full refund", () => {
    const r = computeRefund(10000, 6000, 4000);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.isFullRefund).toBe(true);
    expect(r.cumulativeRefundedClp).toBe(10000);
  });

  it("sin monto explícito reembolsa solo el saldo restante (no el total)", () => {
    const r = computeRefund(10000, 4000, undefined);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.refundAmountClp).toBe(6000);
    expect(r.cumulativeRefundedClp).toBe(10000);
    expect(r.isFullRefund).toBe(true);
  });

  it("rechaza monto cero o negativo", () => {
    expect(computeRefund(10000, 0, 0).ok).toBe(false);
    expect(computeRefund(10000, 0, -500).ok).toBe(false);
  });
});
