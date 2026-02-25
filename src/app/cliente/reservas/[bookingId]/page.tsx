"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { MarketNav } from "@/components/market-nav";

type Message = {
  id: string;
  body: string;
  createdAt: string;
  sender: { fullName: string };
};

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
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatBody, setChatBody] = useState("");
  const [reviewScore, setReviewScore] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

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
          const response = await fetch(`/api/marketplace/bookings/${bookingId}/messages`);
          const data = (await response.json()) as { messages?: Message[]; error?: string; detail?: string };
          if (!response.ok || !data.messages) throw new Error(data.detail || data.error || "No se pudo cargar chat");
          setMessages(data.messages);
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
      setMessages((prev) => [...prev, data.message!]);
      setChatBody("");
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
      setFeedback(`Reseña enviada: ${data.review.id}`);
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
          <h2>Chat y acciones</h2>
          <p>Reserva {bookingId}</p>
        </div>

        <div className="chat-box">
          {messages.map((item) => (
            <p key={item.id}>
              <strong>{item.sender.fullName}:</strong> {item.body}
            </p>
          ))}
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

        <div className="action-grid">
          <label>
            Calificacion
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
            Motivo disputa
            <input value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} />
          </label>
          <button className="cta ghost small" type="button" onClick={openDispute}>
            Abrir disputa
          </button>
        </div>
      </section>

      {feedback ? <p className="feedback ok">{feedback}</p> : null}
      {error ? <p className="feedback error">{error}</p> : null}
    </main>
  );
}
