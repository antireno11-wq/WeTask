import type { CardFormData } from "./types";

export const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  PENDING_PAYMENT: "Pago pendiente",
  ACCEPTED: "Aceptado por el tasker",
  ASSIGNED: "Tasker asignado",
  CONFIRMED: "Reserva confirmada",
  IN_PROGRESS: "Servicio en curso",
  AWAITING_CUSTOMER_CONFIRMATION: "Esperando tu confirmación",
  COMPLETED: "Trabajo realizado",
  PAYOUT_SCHEDULED: "Pago programado",
  PAID_OUT: "Pago realizado",
  DISPUTE_OPEN: "Disputa abierta",
  DISPUTE: "Disputa abierta",
  CANCELLED: "Cancelado",
  REFUNDED: "Reembolsado",
  PAYMENT_FAILED: "Pago fallido"
};

export function clp(value: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value);
}

export function formatBookingDate(value: string) {
  return new Date(value).toLocaleString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function bookingEyebrow(status: string, scheduledAt: string) {
  if (status === "COMPLETED") return "Servicio realizado";
  if (status === "IN_PROGRESS") return "Servicio en curso";
  if (new Date(scheduledAt).getTime() >= Date.now()) return "Próxima visita";
  return "Servicio agendado";
}

export function statusLabelByBooking(status: string) {
  return STATUS_LABELS[status] ?? status;
}

export function statusClassByBooking(status: string) {
  if (status === "COMPLETED") return "status-completed";
  if (status === "CANCELLED" || status === "REFUNDED") return "status-cancelled";
  if (status === "ACCEPTED" || status === "IN_PROGRESS" || status === "ASSIGNED" || status === "CONFIRMED") {
    return "status-accepted";
  }
  return "status-pending";
}

export function describeMercadoPagoError(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (error && typeof error === "object") {
    const maybeMessage =
      "message" in error && typeof error.message === "string"
        ? error.message
        : "cause" in error && typeof error.cause === "string"
          ? error.cause
          : "type" in error && typeof error.type === "string"
            ? error.type
            : "";
    if (maybeMessage.trim()) return maybeMessage;
    return JSON.stringify(error);
  }
  return "No pudimos inicializar el formulario de tarjeta. Revisa que la Public Key de Mercado Pago sea correcta y que no estés mezclando credenciales de prueba y producción.";
}

export function getCardTokenFromData(cardData: CardFormData & { token?: string | { id?: string } | null }) {
  if (typeof cardData.token === "string") return cardData.token;
  if (cardData.token && typeof cardData.token === "object") {
    const nestedToken = cardData.token as { id?: string };
    if (typeof nestedToken.id === "string") {
      return nestedToken.id;
    }
  }
  return "";
}
