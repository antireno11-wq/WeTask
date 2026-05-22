import { BookingStatus } from "@prisma/client";

export type BookingActor = "CUSTOMER" | "PRO" | "ADMIN" | "SYSTEM";

export type BookingTransition = {
  from: BookingStatus;
  to: BookingStatus;
  by: ReadonlyArray<BookingActor>;
};

/**
 * Tabla blanca de transiciones permitidas para Booking.status.
 *
 * - `from === null` significa "creación inicial" (no se valida).
 * - `SYSTEM` representa el webhook de pago, crons (auto-payout / reconciliación),
 *   y otros triggers automáticos.
 * - ADMIN siempre puede transicionar (excepto a estados que no existen en runtime);
 *   se modelan con permisos explícitos para mantener la tabla auditable.
 *
 * Estados nunca escritos por el código actual: PENDING (default value), DISPUTE_OPEN,
 * PAID_OUT. Se omiten de la tabla por seguridad: si alguien intenta llegar a ellos
 * el assert va a tirar.
 */
export const BOOKING_TRANSITIONS: ReadonlyArray<BookingTransition> = [
  // checkout (pago) flow
  { from: BookingStatus.PENDING_PAYMENT, to: BookingStatus.CONFIRMED, by: ["SYSTEM", "ADMIN"] },
  { from: BookingStatus.PENDING_PAYMENT, to: BookingStatus.PAYMENT_FAILED, by: ["SYSTEM", "ADMIN"] },
  { from: BookingStatus.PENDING_PAYMENT, to: BookingStatus.PENDING_PAYMENT, by: ["SYSTEM"] },
  { from: BookingStatus.PAYMENT_FAILED, to: BookingStatus.CONFIRMED, by: ["SYSTEM", "ADMIN"] },
  { from: BookingStatus.PAYMENT_FAILED, to: BookingStatus.CANCELLED, by: ["CUSTOMER", "ADMIN"] },

  // legacy paths (CREATED / ASSIGNED se podrían eliminar en un futuro)
  { from: BookingStatus.CREATED, to: BookingStatus.CONFIRMED, by: ["SYSTEM", "ADMIN"] },
  { from: BookingStatus.CREATED, to: BookingStatus.CANCELLED, by: ["CUSTOMER", "ADMIN"] },
  { from: BookingStatus.ASSIGNED, to: BookingStatus.CONFIRMED, by: ["SYSTEM", "ADMIN"] },
  { from: BookingStatus.ASSIGNED, to: BookingStatus.ACCEPTED, by: ["PRO", "ADMIN"] },
  { from: BookingStatus.ASSIGNED, to: BookingStatus.CANCELLED, by: ["CUSTOMER", "PRO", "ADMIN"] },

  // pro execution flow
  { from: BookingStatus.CONFIRMED, to: BookingStatus.ACCEPTED, by: ["PRO", "ADMIN"] },
  { from: BookingStatus.CONFIRMED, to: BookingStatus.IN_PROGRESS, by: ["PRO", "ADMIN"] },
  { from: BookingStatus.CONFIRMED, to: BookingStatus.CANCELLED, by: ["CUSTOMER", "PRO", "ADMIN"] },
  { from: BookingStatus.ACCEPTED, to: BookingStatus.IN_PROGRESS, by: ["PRO", "ADMIN"] },
  { from: BookingStatus.ACCEPTED, to: BookingStatus.CANCELLED, by: ["CUSTOMER", "PRO", "ADMIN"] },
  { from: BookingStatus.IN_PROGRESS, to: BookingStatus.AWAITING_CUSTOMER_CONFIRMATION, by: ["PRO", "ADMIN"] },
  { from: BookingStatus.IN_PROGRESS, to: BookingStatus.CANCELLED, by: ["ADMIN"] },

  // post-execution / payout
  { from: BookingStatus.AWAITING_CUSTOMER_CONFIRMATION, to: BookingStatus.COMPLETED, by: ["CUSTOMER", "ADMIN"] },
  { from: BookingStatus.AWAITING_CUSTOMER_CONFIRMATION, to: BookingStatus.PAYOUT_SCHEDULED, by: ["CUSTOMER", "SYSTEM", "ADMIN"] },
  { from: BookingStatus.AWAITING_CUSTOMER_CONFIRMATION, to: BookingStatus.DISPUTE, by: ["CUSTOMER", "PRO", "ADMIN"] },
  { from: BookingStatus.PAYOUT_SCHEDULED, to: BookingStatus.COMPLETED, by: ["SYSTEM", "ADMIN"] },
  { from: BookingStatus.PAYOUT_SCHEDULED, to: BookingStatus.DISPUTE, by: ["CUSTOMER", "PRO", "ADMIN"] },

  // dispute lifecycle
  { from: BookingStatus.DISPUTE, to: BookingStatus.REFUNDED, by: ["ADMIN", "SYSTEM"] },
  { from: BookingStatus.DISPUTE, to: BookingStatus.PAYOUT_SCHEDULED, by: ["ADMIN"] },
  { from: BookingStatus.DISPUTE, to: BookingStatus.COMPLETED, by: ["ADMIN"] },
  { from: BookingStatus.DISPUTE, to: BookingStatus.CANCELLED, by: ["ADMIN"] },

  // refund: admin manual refund desde cualquier estado pagado
  { from: BookingStatus.CONFIRMED, to: BookingStatus.REFUNDED, by: ["ADMIN", "SYSTEM"] },
  { from: BookingStatus.ACCEPTED, to: BookingStatus.REFUNDED, by: ["ADMIN", "SYSTEM"] },
  { from: BookingStatus.IN_PROGRESS, to: BookingStatus.REFUNDED, by: ["ADMIN", "SYSTEM"] },
  { from: BookingStatus.AWAITING_CUSTOMER_CONFIRMATION, to: BookingStatus.REFUNDED, by: ["ADMIN", "SYSTEM"] },
  { from: BookingStatus.PAYOUT_SCHEDULED, to: BookingStatus.REFUNDED, by: ["ADMIN", "SYSTEM"] },

  // dispute → opened from active states
  { from: BookingStatus.CONFIRMED, to: BookingStatus.DISPUTE, by: ["CUSTOMER", "PRO", "ADMIN"] },
  { from: BookingStatus.ACCEPTED, to: BookingStatus.DISPUTE, by: ["CUSTOMER", "PRO", "ADMIN"] },
  { from: BookingStatus.IN_PROGRESS, to: BookingStatus.DISPUTE, by: ["CUSTOMER", "PRO", "ADMIN"] },
  { from: BookingStatus.COMPLETED, to: BookingStatus.DISPUTE, by: ["CUSTOMER", "PRO", "ADMIN"] }
];

export class InvalidBookingTransitionError extends Error {
  readonly from: BookingStatus;
  readonly to: BookingStatus;
  readonly by: BookingActor;

  constructor(from: BookingStatus, to: BookingStatus, by: BookingActor) {
    super(`Transición de booking inválida: ${from} → ${to} por ${by}`);
    this.name = "InvalidBookingTransitionError";
    this.from = from;
    this.to = to;
    this.by = by;
  }
}

export function canTransition(from: BookingStatus, to: BookingStatus, by: BookingActor): boolean {
  if (from === to) return true; // idempotent re-write
  return BOOKING_TRANSITIONS.some((t) => t.from === from && t.to === to && t.by.includes(by));
}

export function assertTransition(from: BookingStatus, to: BookingStatus, by: BookingActor): void {
  if (!canTransition(from, to, by)) {
    throw new InvalidBookingTransitionError(from, to, by);
  }
}
