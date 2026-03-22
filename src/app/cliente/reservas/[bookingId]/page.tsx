"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { MarketNav } from "@/components/market-nav";
import {
  canShareContactDetails,
  messageContainsRestrictedContactInfo,
  PRE_CONFIRMATION_CHAT_BLOCK_MESSAGE
} from "@/lib/chat-safety";

type Message = {
  id: string;
  body: string;
  createdAt: string;
  sender: { fullName: string };
};

type BookingDetail = {
  id: string;
  status: string;
  paymentStatus: string;
  scheduledAt: string;
  hours: number;
  slotMinutes: number;
  notes: string | null;
  subtotalClp: number;
  extrasTotalClp: number;
  platformFeeClp: number;
  totalPriceClp: number;
  service: { name: string };
  customer: { id: string; fullName: string; email: string };
  pro: { id: string; fullName: string; email: string } | null;
  address: { street: string; city: string; postalCode: string; region: string | null } | null;
  addressLine1: string;
  comuna: string;
  city: string | null;
  postalCode: string | null;
  review: { id: string; rating: number; comment: string | null } | null;
  extras: Array<{ id: string; label: string; priceClp: number }>;
  disputes?: Array<{ id: string; status: string; category: string | null; createdAt: string }>;
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  PENDING_PAYMENT: "Pago pendiente",
  ACCEPTED: "Aceptado por el tasker",
  ASSIGNED: "Tasker asignado",
  CONFIRMED: "Reserva confirmada",
  IN_PROGRESS: "Servicio en curso",
  COMPLETED: "Servicio cerrado",
  CANCELLED: "Cancelado",
  REFUNDED: "Reembolsado",
  PAYMENT_FAILED: "Pago fallido",
  DISPUTE: "En revisión"
};

const PAYMENT_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  PAID: "Pagado",
  FAILED: "Fallido",
  REFUNDED: "Reembolsado",
  PARTIAL_REFUNDED: "Reembolso parcial"
};

function clp(value: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value);
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatTime(value: Date) {
  return value.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
}

export default function ClienteBookingActionsPage() {
  const params = useParams<{ bookingId: string }>();
  const bookingId = params?.bookingId ?? "";

  const [customerId, setCustomerId] = useState("");
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatBody, setChatBody] = useState("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  const bookingEnd = useMemo(() => {
    if (!booking) return null;
    return new Date(new Date(booking.scheduledAt).getTime() + booking.hours * 60 * 60 * 1000);
  }, [booking]);

  useEffect(() => {
    const load = async () => {
      try {
        const sessionRes = await fetch("/api/auth/session");
        const sessionData = (await sessionRes.json()) as { session?: { userId: string } | null; error?: string; detail?: string };
        if (!sessionRes.ok || !sessionData.session?.userId) {
          throw new Error(sessionData.detail || sessionData.error || "No se pudo cargar sesión");
        }
        setCustomerId(sessionData.session.userId);

        if (bookingId) {
          const [bookingResponse, messagesResponse] = await Promise.all([
            fetch(`/api/marketplace/bookings/${bookingId}`),
            fetch(`/api/marketplace/bookings/${bookingId}/messages`)
          ]);

          const bookingData = (await bookingResponse.json()) as { booking?: BookingDetail; error?: string; detail?: string };
          const messagesData = (await messagesResponse.json()) as { messages?: Message[]; error?: string; detail?: string };

          if (!bookingResponse.ok || !bookingData.booking) {
            throw new Error(bookingData.detail || bookingData.error || "No se pudo cargar la reserva");
          }
          if (!messagesResponse.ok || !messagesData.messages) {
            throw new Error(messagesData.detail || messagesData.error || "No se pudo cargar el chat");
          }

          setBooking(bookingData.booking);
          setMessages(messagesData.messages);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error inesperado");
      }
    };
    void load();
  }, [bookingId]);

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    if (!bookingId || !chatBody.trim()) return;
    setError("");

    if (booking && !canShareContactDetails(booking.status) && messageContainsRestrictedContactInfo(chatBody)) {
      setError(PRE_CONFIRMATION_CHAT_BLOCK_MESSAGE);
      return;
    }

    try {
      const response = await fetch(`/api/marketplace/bookings/${bookingId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: chatBody })
      });
      const data = (await response.json()) as { message?: Message; error?: string; detail?: string };
      if (!response.ok || !data.message) throw new Error(data.detail || data.error || "No se pudo enviar mensaje");
      const nextMessage = data.message;
      setMessages((prev) => [...prev, nextMessage]);
      setChatBody("");
      setFeedback("Mensaje enviado.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    }
  };

  const confirmService = async () => {
    if (!bookingId || !customerId) return;
    setError("");
    setFeedback("");
    try {
      const response = await fetch(`/api/marketplace/bookings/${bookingId}/customer-confirm`, { method: "POST" });
      const data = (await response.json()) as { booking?: BookingDetail; ok?: boolean; error?: string; detail?: string };
      if (!response.ok || (!data.booking && !data.ok)) throw new Error(data.detail || data.error || "No se pudo confirmar el servicio");
      if (data.booking) {
        setBooking(data.booking);
      }
      setFeedback("Servicio confirmado. El pago quedó programado para el próximo ciclo automático.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    }
  };

  return (
    <main className="auth-flow-screen auth-flow-screen-scroll market-shell-auth">
      <div className="auth-flow-backdrop" aria-hidden />

      <div className="login-screen-content market-shell-auth-content">
        <MarketNav />

        <section className="auth-flow-shell auth-flow-shell-wide client-dashboard-hero">
          <div className="auth-flow-copy client-dashboard-copy">
            <p className="auth-flow-kicker">Detalle de reserva</p>
            <h1>{booking?.service.name ?? "Tu servicio en WeTask"}</h1>
            <p>Revisa el costo, la dirección, el horario acordado con el profesional y todas las acciones disponibles desde un solo lugar.</p>
          </div>

          <section className="auth-flow-panel auth-flow-panel-wide client-dashboard-profile-panel">
            <div className="panel-head client-dashboard-panel-head">
              <h2>Resumen rápido</h2>
              <p>Estado actual y datos principales de esta reserva.</p>
            </div>

            {booking ? (
              <div className="client-booking-overview">
                <article className="module-card client-dashboard-metric">
                  <h3>Estado</h3>
                  <p>{STATUS_LABELS[booking.status] ?? booking.status}</p>
                </article>
                <article className="module-card client-dashboard-metric">
                  <h3>Total</h3>
                  <p>{clp(booking.totalPriceClp)}</p>
                </article>
                <article className="module-card client-dashboard-metric">
                  <h3>Pago</h3>
                  <p>{PAYMENT_LABELS[booking.paymentStatus] ?? booking.paymentStatus}</p>
                  <small>Dinero protegido hasta confirmar el servicio o hasta que venza el plazo sin reclamo.</small>
                </article>
              </div>
            ) : (
              <p className="empty">Cargando reserva...</p>
            )}
          </section>
        </section>

        <div className="page client-dashboard-sections">
          {feedback ? <p className="feedback ok">{feedback}</p> : null}
          {error ? <p className="feedback error">{error}</p> : null}

          {booking ? (
            <>
              <section className="auth-flow-panel client-dashboard-section">
                <div className="panel-head client-dashboard-panel-head">
                  <h2>Resumen del servicio</h2>
                  <p>Todo lo importante antes, durante y después de la visita.</p>
                </div>

                <div className="client-booking-summary-grid">
                  <article className="booking-card client-dashboard-card client-booking-summary-card">
                    <h3>Horario acordado</h3>
                    <p>
                      <strong>Inicio:</strong> {formatDateTime(booking.scheduledAt)}
                    </p>
                    <p>
                      <strong>Término estimado:</strong> {bookingEnd ? formatTime(bookingEnd) : "Por definir"}
                    </p>
                    <p>
                      <strong>Duración estimada:</strong> {booking.hours} hora(s)
                    </p>
                  </article>

                  <article className="booking-card client-dashboard-card client-booking-summary-card">
                    <h3>Ubicación</h3>
                    <p>
                      <strong>Dirección:</strong> {booking.address?.street ?? booking.addressLine1}
                    </p>
                    <p>
                      <strong>Comuna:</strong> {booking.comuna}
                    </p>
                    <p>
                      <strong>Ciudad:</strong> {booking.address?.city ?? booking.city ?? "Santiago"}
                    </p>
                  </article>

                  <article className="booking-card client-dashboard-card client-booking-summary-card">
                    <h3>Profesional asignado</h3>
                    <p>
                      <strong>Nombre:</strong> {booking.pro?.fullName ?? "Pendiente de asignación"}
                    </p>
                    <p>
                      <strong>Email:</strong> {booking.pro?.email ?? "Aún no disponible"}
                    </p>
                    <p>
                      <strong>Estado de la visita:</strong> {STATUS_LABELS[booking.status] ?? booking.status}
                    </p>
                  </article>

                  <article className="booking-card client-dashboard-card client-booking-summary-card">
                    <h3>Desglose de costo</h3>
                    <p>
                      <strong>Subtotal:</strong> {clp(booking.subtotalClp)}
                    </p>
                    <p>
                      <strong>Extras:</strong> {clp(booking.extrasTotalClp)}
                    </p>
                    <p>
                      <strong>Comisión plataforma:</strong> {clp(booking.platformFeeClp)}
                    </p>
                    <p className="client-booking-total-line">
                      <strong>Total pagado:</strong> {clp(booking.totalPriceClp)}
                    </p>
                  </article>
                </div>

                {booking.notes ? (
                  <div className="client-booking-note">
                    <strong>Indicaciones del servicio</strong>
                    <p>{booking.notes}</p>
                  </div>
                ) : null}

                <div className="client-booking-note">
                  <strong>Cómo funciona el pago protegido</strong>
                  <p>Pagaste al reservar y WeTask mantiene ese dinero retenido. Cuando el servicio termine, podrás confirmar si todo salió bien o reportar un problema. Si no reclamas dentro del plazo, el pago entra automáticamente al próximo ciclo de pago del profesional.</p>
                </div>
              </section>

              <section className="auth-flow-panel client-dashboard-section">
                <div className="panel-head client-dashboard-panel-head">
                  <h2>Chat y seguimiento</h2>
                  <p>Habla con tu profesional o deja constancia si necesitas soporte.</p>
                </div>

                {booking && !canShareContactDetails(booking.status) ? (
                  <div className="client-booking-note">
                    <strong>Regla de seguridad del chat</strong>
                    <p>{PRE_CONFIRMATION_CHAT_BLOCK_MESSAGE}</p>
                  </div>
                ) : null}

                <div className="chat-box client-booking-chat">
                  {messages.length === 0 ? (
                    <p className="empty">Todavía no hay mensajes en esta reserva.</p>
                  ) : (
                    messages.map((item) => (
                      <p key={item.id}>
                        <strong>{item.sender.fullName}:</strong> {item.body}
                      </p>
                    ))
                  )}
                </div>

                <form className="query-row query-single" onSubmit={sendMessage}>
                  <label>
                    Mensaje
                    <input value={chatBody} onChange={(e) => setChatBody(e.target.value)} placeholder="Escribe al profesional" />
                  </label>
                  <button className="cta small" type="submit">
                    Enviar
                  </button>
                </form>
              </section>

              <section className="auth-flow-panel client-dashboard-section">
                <div className="panel-head client-dashboard-panel-head">
                  <h2>Acciones del servicio</h2>
                  <p>Cuando termine la visita, confirma que todo salió bien o reporta el problema desde aquí.</p>
                </div>

                <div className="booking-actions">
                  <button className="cta" type="button" onClick={confirmService}>
                    Confirmar servicio
                  </button>
                  <Link className="cta ghost" href={`/cliente/reservas/${bookingId}/problema`}>
                    Reportar problema
                  </Link>
                </div>

                <div className="client-booking-note">
                  <strong>Plazo de revisión</strong>
                  <p>Cuando el tasker marca el trabajo como realizado, tu pago sigue retenido. Puedes confirmar el servicio o reportar un problema. Si no reclamas dentro del plazo definido por WeTask, el pago entra al siguiente ciclo automático.</p>
                </div>

                {booking.disputes && booking.disputes.length > 0 ? (
                  <div className="client-booking-note">
                    <strong>Reporte abierto</strong>
                    <p>
                      Ya existe al menos un reporte para este servicio. Puedes revisar el detalle o enviar información adicional desde
                      la pantalla de problema.
                    </p>
                  </div>
                ) : null}
              </section>
            </>
          ) : null}
        </div>
      </div>
    </main>
  );
}
