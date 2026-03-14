"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { MarketNav } from "@/components/market-nav";

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
  review: { id: string } | null;
  disputes: Array<{ id: string; status: string }>;
  extras: Array<{ id: string; label: string; priceClp: number }>;
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  PENDING_PAYMENT: "Pago pendiente",
  ACCEPTED: "Aceptado",
  ASSIGNED: "Asignado",
  CONFIRMED: "Confirmado",
  IN_PROGRESS: "En curso",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
  REFUNDED: "Reembolsado",
  PAYMENT_FAILED: "Pago fallido"
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

function StarPicker(props: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="star-picker" role="radiogroup" aria-label="Calificacion">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className={`star-btn ${star <= props.value ? "active" : ""}`}
          onClick={() => props.onChange(star)}
          aria-label={`${star} estrella${star > 1 ? "s" : ""}`}
          aria-pressed={star <= props.value}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export default function ClienteBookingActionsPage() {
  const params = useParams<{ bookingId: string }>();
  const bookingId = params?.bookingId ?? "";

  const [customerId, setCustomerId] = useState("");
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatBody, setChatBody] = useState("");
  const [reviewScore, setReviewScore] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
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
          throw new Error(sessionData.detail || sessionData.error || "No se pudo cargar sesion");
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

  const leaveReview = async () => {
    if (!bookingId || !customerId) return;
    setError("");
    setFeedback("");
    try {
      const response = await fetch("/api/marketplace/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId,
          authorId: customerId,
          rating: reviewScore,
          comment: reviewComment,
          punctuality: reviewScore,
          quality: reviewScore,
          communication: reviewScore
        })
      });
      const data = (await response.json()) as { review?: { id: string }; error?: string; detail?: string };
      if (!response.ok || !data.review) throw new Error(data.detail || data.error || "No se pudo enviar reseña");
      setFeedback("Reseña enviada correctamente.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    }
  };

  const openDispute = async () => {
    if (!bookingId || !customerId || !disputeReason.trim()) return;
    setError("");
    setFeedback("");
    try {
      const response = await fetch("/api/marketplace/disputes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, openedById: customerId, reason: disputeReason })
      });
      const data = (await response.json()) as { ticket?: { id: string }; error?: string; detail?: string };
      if (!response.ok || !data.ticket) throw new Error(data.detail || data.error || "No se pudo crear disputa");
      setFeedback("Solicitud enviada a soporte.");
      setDisputeReason("");
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
              </section>

              <section className="auth-flow-panel client-dashboard-section">
                <div className="panel-head client-dashboard-panel-head">
                  <h2>Chat y seguimiento</h2>
                  <p>Habla con tu profesional o deja constancia si necesitas soporte.</p>
                </div>

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
                  <h2>Reseña y soporte</h2>
                  <p>Valora tu experiencia o abre un caso si necesitas ayuda.</p>
                </div>

                <div className="action-grid client-booking-actions-grid">
                  <label>
                    Calificación
                    <StarPicker value={reviewScore} onChange={setReviewScore} />
                  </label>
                  <label>
                    Comentario reseña
                    <input value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} />
                  </label>
                  <button className="cta ghost small" type="button" onClick={leaveReview}>
                    Enviar reseña
                  </button>

                  <label>
                    Motivo de soporte
                    <input value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} />
                  </label>
                  <button className="cta ghost small" type="button" onClick={openDispute}>
                    Solicitar ayuda
                  </button>
                </div>
              </section>
            </>
          ) : null}
        </div>
      </div>
    </main>
  );
}
