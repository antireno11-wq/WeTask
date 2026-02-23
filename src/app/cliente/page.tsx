"use client";

import { FormEvent, useState } from "react";
import { MarketNav } from "@/components/market-nav";

type Booking = {
  id: string;
  status: string;
  scheduledAt: string;
  totalPriceClp: number;
  service: { name: string };
  pro: { fullName: string } | null;
};

type Message = {
  id: string;
  body: string;
  createdAt: string;
  sender: { fullName: string };
};

function clp(value: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value);
}

export default function ClientePage() {
  const [customerId, setCustomerId] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatBody, setChatBody] = useState("");
  const [reviewScore, setReviewScore] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  const headers = {
    "Content-Type": "application/json",
    "x-user-id": customerId,
    "x-user-role": "CUSTOMER"
  };

  const loadBookings = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setFeedback("");
    try {
      const response = await fetch(`/api/marketplace/client/bookings?customerId=${customerId}`, { headers });
      const data = (await response.json()) as { bookings?: Booking[]; error?: string; detail?: string };
      if (!response.ok || !data.bookings) throw new Error(data.detail || data.error || "No se pudieron cargar reservas");
      setBookings(data.bookings);
      setFeedback(`Reservas cargadas: ${data.bookings.length}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    }
  };

  const loadMessages = async (bookingId: string) => {
    setSelectedBookingId(bookingId);
    setError("");
    try {
      const response = await fetch(`/api/marketplace/bookings/${bookingId}/messages`, { headers });
      const data = (await response.json()) as { messages?: Message[]; error?: string; detail?: string };
      if (!response.ok || !data.messages) throw new Error(data.detail || data.error || "No se pudo cargar chat");
      setMessages(data.messages);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    }
  };

  const sendMessage = async () => {
    if (!selectedBookingId || !chatBody.trim()) return;
    setError("");
    try {
      const response = await fetch(`/api/marketplace/bookings/${selectedBookingId}/messages`, {
        method: "POST",
        headers,
        body: JSON.stringify({ body: chatBody })
      });
      const data = (await response.json()) as { message?: Message; error?: string; detail?: string };
      if (!response.ok || !data.message) throw new Error(data.detail || data.error || "No se pudo enviar mensaje");
      const newMessage = data.message;
      setMessages((prev) => [...prev, newMessage]);
      setChatBody("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    }
  };

  const leaveReview = async () => {
    if (!selectedBookingId) return;
    setError("");
    setFeedback("");

    try {
      const response = await fetch("/api/marketplace/reviews", {
        method: "POST",
        headers,
        body: JSON.stringify({
          bookingId: selectedBookingId,
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
      setFeedback(`Reseña enviada: ${data.review.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    }
  };

  const openDispute = async () => {
    if (!selectedBookingId || !disputeReason.trim()) return;
    setError("");
    setFeedback("");
    try {
      const response = await fetch("/api/marketplace/disputes", {
        method: "POST",
        headers,
        body: JSON.stringify({ bookingId: selectedBookingId, openedById: customerId, reason: disputeReason })
      });
      const data = (await response.json()) as { ticket?: { id: string }; error?: string; detail?: string };
      if (!response.ok || !data.ticket) throw new Error(data.detail || data.error || "No se pudo crear disputa");
      setFeedback(`Disputa creada: ${data.ticket.id}`);
      setDisputeReason("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    }
  };

  return (
    <main className="page market-shell">
      <MarketNav />
      <section className="panel">
        <div className="panel-head">
          <h2>Panel Cliente</h2>
          <p>Mis reservas, chat, reseña y soporte.</p>
        </div>

        <form className="query-row query-single" onSubmit={loadBookings}>
          <label>
            Customer ID
            <input value={customerId} onChange={(e) => setCustomerId(e.target.value)} required placeholder="cuid cliente" />
          </label>
          <button className="cta ghost" type="submit">
            Cargar reservas
          </button>
        </form>
      </section>

      <section className="list">
        {bookings.map((booking) => (
          <article className="booking-card" key={booking.id}>
            <div className="booking-head">
              <h3>{booking.service.name}</h3>
              <span className="status status-accepted">{booking.status}</span>
            </div>
            <p>
              <strong>ID:</strong> {booking.id}
            </p>
            <p>
              <strong>Fecha:</strong> {new Date(booking.scheduledAt).toLocaleString("es-ES")}
            </p>
            <p>
              <strong>Profesional:</strong> {booking.pro?.fullName ?? "Pendiente"}
            </p>
            <p>
              <strong>Total:</strong> {clp(booking.totalPriceClp)}
            </p>
            <button className="cta small" onClick={() => loadMessages(booking.id)} type="button">
              Abrir chat / acciones
            </button>
          </article>
        ))}
      </section>

      {selectedBookingId ? (
        <section className="panel">
          <div className="panel-head">
            <h2>Reserva {selectedBookingId}</h2>
          </div>

          <div className="chat-box">
            {messages.map((item) => (
              <p key={item.id}>
                <strong>{item.sender.fullName}:</strong> {item.body}
              </p>
            ))}
          </div>

          <div className="query-row query-single">
            <label>
              Mensaje
              <input value={chatBody} onChange={(e) => setChatBody(e.target.value)} placeholder="Escribe al profesional" />
            </label>
            <button className="cta small" type="button" onClick={sendMessage}>
              Enviar
            </button>
          </div>

          <div className="action-grid">
            <label>
              Rating (1-5)
              <input type="number" min={1} max={5} value={reviewScore} onChange={(e) => setReviewScore(Number(e.target.value) || 5)} />
            </label>
            <label>
              Comentario reseña
              <input value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} />
            </label>
            <button className="cta ghost small" type="button" onClick={leaveReview}>
              Enviar reseña
            </button>

            <label>
              Motivo disputa
              <input value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} />
            </label>
            <button className="cta ghost small" type="button" onClick={openDispute}>
              Abrir disputa
            </button>
          </div>
        </section>
      ) : null}

      {feedback ? <p className="feedback ok">{feedback}</p> : null}
      {error ? <p className="feedback error">{error}</p> : null}
    </main>
  );
}
