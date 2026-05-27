import { BookingStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  assertTransition,
  BOOKING_TRANSITIONS,
  canTransition,
  InvalidBookingTransitionError
} from "./booking-state-machine";

describe("booking-state-machine", () => {
  describe("canTransition", () => {
    it("permite el flujo feliz cliente: PENDING_PAYMENT → CONFIRMED → ACCEPTED → IN_PROGRESS → AWAITING_CUSTOMER_CONFIRMATION → PAYOUT_SCHEDULED → COMPLETED", () => {
      expect(canTransition(BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED, "SYSTEM")).toBe(true);
      expect(canTransition(BookingStatus.CONFIRMED, BookingStatus.ACCEPTED, "PRO")).toBe(true);
      expect(canTransition(BookingStatus.ACCEPTED, BookingStatus.IN_PROGRESS, "PRO")).toBe(true);
      expect(canTransition(BookingStatus.IN_PROGRESS, BookingStatus.AWAITING_CUSTOMER_CONFIRMATION, "PRO")).toBe(true);
      expect(canTransition(BookingStatus.AWAITING_CUSTOMER_CONFIRMATION, BookingStatus.PAYOUT_SCHEDULED, "CUSTOMER")).toBe(true);
      expect(canTransition(BookingStatus.PAYOUT_SCHEDULED, BookingStatus.COMPLETED, "SYSTEM")).toBe(true);
    });

    it("permite transición idempotente (mismo estado)", () => {
      expect(canTransition(BookingStatus.CONFIRMED, BookingStatus.CONFIRMED, "ADMIN")).toBe(true);
      expect(canTransition(BookingStatus.PAYMENT_FAILED, BookingStatus.PAYMENT_FAILED, "SYSTEM")).toBe(true);
    });

    it("rechaza saltos hacia atrás ilegales: COMPLETED → CONFIRMED por PRO", () => {
      expect(canTransition(BookingStatus.COMPLETED, BookingStatus.CONFIRMED, "PRO")).toBe(false);
    });

    it("rechaza CUSTOMER moviendo a IN_PROGRESS (sólo PRO/ADMIN puede)", () => {
      expect(canTransition(BookingStatus.CONFIRMED, BookingStatus.IN_PROGRESS, "CUSTOMER")).toBe(false);
    });

    it("rechaza estados no listados (e.g. PENDING_PAYMENT → COMPLETED)", () => {
      expect(canTransition(BookingStatus.PENDING_PAYMENT, BookingStatus.COMPLETED, "SYSTEM")).toBe(false);
    });

    it("permite cualquier parte abrir disputa desde CONFIRMED", () => {
      expect(canTransition(BookingStatus.CONFIRMED, BookingStatus.DISPUTE, "CUSTOMER")).toBe(true);
      expect(canTransition(BookingStatus.CONFIRMED, BookingStatus.DISPUTE, "PRO")).toBe(true);
      expect(canTransition(BookingStatus.CONFIRMED, BookingStatus.DISPUTE, "ADMIN")).toBe(true);
    });

    it("permite refund por ADMIN o SYSTEM desde múltiples estados pagados", () => {
      const refundableFrom = [
        BookingStatus.CONFIRMED,
        BookingStatus.ACCEPTED,
        BookingStatus.IN_PROGRESS,
        BookingStatus.AWAITING_CUSTOMER_CONFIRMATION,
        BookingStatus.PAYOUT_SCHEDULED,
        BookingStatus.DISPUTE
      ];
      for (const from of refundableFrom) {
        expect(canTransition(from, BookingStatus.REFUNDED, "ADMIN")).toBe(true);
      }
    });

    it("rechaza refund por PRO (solo ADMIN/SYSTEM)", () => {
      expect(canTransition(BookingStatus.CONFIRMED, BookingStatus.REFUNDED, "PRO")).toBe(false);
    });
  });

  describe("assertTransition", () => {
    it("no tira cuando la transición es válida", () => {
      expect(() => assertTransition(BookingStatus.IN_PROGRESS, BookingStatus.AWAITING_CUSTOMER_CONFIRMATION, "PRO")).not.toThrow();
    });

    it("tira InvalidBookingTransitionError con metadata cuando es inválida", () => {
      try {
        assertTransition(BookingStatus.COMPLETED, BookingStatus.PENDING_PAYMENT, "CUSTOMER");
        throw new Error("debería haber tirado");
      } catch (err) {
        expect(err).toBeInstanceOf(InvalidBookingTransitionError);
        if (err instanceof InvalidBookingTransitionError) {
          expect(err.from).toBe(BookingStatus.COMPLETED);
          expect(err.to).toBe(BookingStatus.PENDING_PAYMENT);
          expect(err.by).toBe("CUSTOMER");
        }
      }
    });
  });

  describe("estados muertos del enum", () => {
    it("no tiene transiciones definidas hacia PENDING (default no escrito)", () => {
      const targetsToPending = BOOKING_TRANSITIONS.filter((t) => t.to === BookingStatus.PENDING);
      expect(targetsToPending).toHaveLength(0);
    });

    it("no tiene transiciones hacia DISPUTE_OPEN (estado huérfano)", () => {
      const targetsToDisputeOpen = BOOKING_TRANSITIONS.filter((t) => t.to === BookingStatus.DISPUTE_OPEN);
      expect(targetsToDisputeOpen).toHaveLength(0);
    });

    it("no tiene transiciones hacia PAID_OUT (estado huérfano)", () => {
      const targetsToPaidOut = BOOKING_TRANSITIONS.filter((t) => t.to === BookingStatus.PAID_OUT);
      expect(targetsToPaidOut).toHaveLength(0);
    });
  });
});
