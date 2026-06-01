"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { BookingChatPanel, type BookingChatMessage } from "@/components/booking-chat-panel";
import { BookingServiceActionsPanel } from "@/components/booking-service-actions-panel";
import { MarketNav } from "@/components/market-nav";
import {
  canShareContactDetails,
  messageContainsRestrictedContactInfo,
  PRE_CONFIRMATION_CHAT_BLOCK_MESSAGE
} from "@/lib/chat-safety";

type TaskerBookingDetail = {
  id: string;
  status: string;
  paymentStatus: string;
  scheduledAt: string;
  hours: number;
  slotMinutes: number;
  notes: string | null;
  totalPriceClp: number;
  service: { name: string };
  customer: { id: string; fullName: string; email: string };
  pro: { id: string; fullName: string; email: string } | null;
  address: { street: string; city: string; postalCode: string; region: string | null } | null;
  addressLine1: string;
  comuna: string;
  city: string | null;
  payout: { status: string } | null;
  disputes?: Array<{ id: string; status: string; category: string | null; createdAt: string }>;
  onTheWayAt: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
};

type TaskerBookingView = "resumen" | "chat" | "acciones";

const TASKER_STATUS_OPTIONS = ["ACCEPTED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

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
  PARTIAL_REFUNDED: "Reembolso parcial",
  AUTHORIZED: "Autorizado"
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

export default function ProBookingDetailPage() {
  const params = useParams<{ bookingId: string }>();
  const bookingId = params?.bookingId ?? "";

  const [taskerId, setTaskerId] = useState("");
  const [booking, setBooking] = useState<TaskerBookingDetail | null>(null);
  const [messages, setMessages] = useState<BookingChatMessage[]>([]);
  const [chatBody, setChatBody] = useState("");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [activeView, setActiveView] = useState<TaskerBookingView>("resumen");
  const [statusValue, setStatusValue] = useState("ACCEPTED");

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
        setTaskerId(sessionData.session.userId);

        if (bookingId) {
          const [bookingResponse, messagesResponse] = await Promise.all([
            fetch(`/api/marketplace/bookings/${bookingId}`),
            fetch(`/api/marketplace/bookings/${bookingId}/messages`)
          ]);

          const bookingData = (await bookingResponse.json()) as { booking?: TaskerBookingDetail; error?: string; detail?: string };
          const messagesData = (await messagesResponse.json()) as { messages?: BookingChatMessage[]; error?: string; detail?: string };

          if (!bookingResponse.ok || !bookingData.booking) {
            throw new Error(bookingData.detail || bookingData.error || "No se pudo cargar la reserva");
          }
          if (!messagesResponse.ok || !messagesData.messages) {
            throw new Error(messagesData.detail || messagesData.error || "No se pudo cargar el chat");
          }

          setBooking(bookingData.booking);
          setStatusValue(bookingData.booking.status);
          setMessages(messagesData.messages);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error inesperado");
      }
    };
    void load();
  }, [bookingId]);

  useEffect(() => {
    if (!bookingId || activeView !== "chat") return;

    const interval = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/marketplace/bookings/${bookingId}/messages`, { cache: "no-store" });
        const data = (await response.json()) as { messages?: BookingChatMessage[] };
        if (response.ok && data.messages) {
          // UX-11: merge en vez de reemplazo (no pisa mensajes optimistas).
          const server = data.messages;
          setMessages((prev) => [...server, ...prev.filter((m) => !new Set(server.map((s) => s.id)).has(m.id))]);
        }
      } catch {
        // Silent polling refresh
      }
    }, 10000);

    return () => window.clearInterval(interval);
  }, [activeView, bookingId]);

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!bookingId || !chatBody.trim()) return;
    setError("");
    setFeedback("");

    if (booking && !canShareContactDetails(booking.status) && messageContainsRestrictedContactInfo(chatBody)) {
      setError(PRE_CONFIRMATION_CHAT_BLOCK_MESSAGE);
      return;
    }

    try {
      setSending(true);
      const response = await fetch(`/api/marketplace/bookings/${bookingId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: chatBody })
      });
      const data = (await response.json()) as { message?: BookingChatMessage; error?: string; detail?: string };
      if (!response.ok || !data.message) throw new Error(data.detail || data.error || "No se pudo enviar mensaje");
      setMessages((prev) => [...prev, data.message!]);
      setChatBody("");
      setFeedback("Mensaje enviado al cliente.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setSending(false);
    }
  };

  const updateStatus = async () => {
    if (!bookingId) return;
    setError("");
    setFeedback("");
    try {
      setSavingStatus(true);
      const response = await fetch(`/api/marketplace/bookings/${bookingId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: statusValue })
      });
      const data = (await response.json()) as { booking?: { status: string }; error?: string; detail?: string };
      if (!response.ok || !data.booking) throw new Error(data.detail || data.error || "No se pudo actualizar estado");
      setBooking((current) => (current ? { ...current, status: data.booking!.status } : current));
      setStatusValue(data.booking.status);
      setFeedback(`Estado actualizado a ${STATUS_LABELS[data.booking.status] ?? data.booking.status}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setSavingStatus(false);
    }
  };

  const completeBooking = async () => {
    if (!bookingId) return;
    setError("");
    setFeedback("");
    try {
      setSavingStatus(true);
      const response = await fetch(`/api/marketplace/bookings/${bookingId}/complete`, {
        method: "POST"
      });
      const data = (await response.json()) as { booking?: { status: string }; error?: string; detail?: string };
      if (!response.ok || !data.booking) throw new Error(data.detail || data.error || "No se pudo finalizar reserva");
      setBooking((current) => (current ? { ...current, status: data.booking!.status } : current));
      setStatusValue(data.booking.status);
      setFeedback("Servicio marcado como realizado.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setSavingStatus(false);
    }
  };

  return (
    <main className="auth-flow-screen auth-flow-screen-scroll market-shell-auth">
      <div className="auth-flow-backdrop" aria-hidden />

      <div className="login-screen-content market-shell-auth-content">
        <MarketNav />

        <section className="auth-flow-shell auth-flow-shell-wide client-dashboard-hero">
          <div className="auth-flow-copy client-dashboard-copy">
            <p className="auth-flow-kicker">Detalle de reserva tasker</p>
            <h1>{booking?.service.name ?? "Tu servicio en WeTask"}</h1>
            <p>Revisa los datos del servicio, conversa con el cliente y actualiza el estado de la reserva desde un solo lugar.</p>
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
                  <small>{booking.payout?.status ? `Payout: ${booking.payout.status}` : "Pago retenido hasta cierre o confirmación."}</small>
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
              <div className="dashboard-switcher booking-detail-switcher">
                <button
                  type="button"
                  className={`dashboard-switch ${activeView === "resumen" ? "active" : ""}`}
                  onClick={() => setActiveView("resumen")}
                >
                  Resumen
                </button>
                <button
                  type="button"
                  className={`dashboard-switch ${activeView === "chat" ? "active" : ""}`}
                  onClick={() => setActiveView("chat")}
                >
                  Chat
                </button>
                <button
                  type="button"
                  className={`dashboard-switch ${activeView === "acciones" ? "active" : ""}`}
                  onClick={() => setActiveView("acciones")}
                >
                  Acciones del servicio
                </button>
              </div>

              {activeView === "resumen" ? (
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
                      <h3>Cliente</h3>
                      <p>
                        <strong>Nombre:</strong> {booking.customer.fullName}
                      </p>
                      <p>
                        <strong>Email:</strong> {booking.customer.email}
                      </p>
                      <p>
                        <strong>Estado del servicio:</strong> {STATUS_LABELS[booking.status] ?? booking.status}
                      </p>
                    </article>

                    <article className="booking-card client-dashboard-card client-booking-summary-card">
                      <h3>Pago y cierre</h3>
                      <p>
                        <strong>Total reservado:</strong> {clp(booking.totalPriceClp)}
                      </p>
                      <p>
                        <strong>Pago:</strong> {PAYMENT_LABELS[booking.paymentStatus] ?? booking.paymentStatus}
                      </p>
                      <p>
                        <strong>Payout:</strong> {booking.payout?.status ?? "Aún no solicitado"}
                      </p>
                    </article>
                  </div>

                  {booking.notes ? (
                    <div className="client-booking-note">
                      <strong>Indicaciones del cliente</strong>
                      <p>{booking.notes}</p>
                    </div>
                  ) : null}

                  <div className="client-booking-note">
                    <strong>Cómo funciona este servicio</strong>
                    <p>
                      Puedes usar el chat para resolver dudas del servicio y mantener todo dentro de WeTask. Cuando termines la visita,
                      actualiza el estado y luego marca el servicio como realizado para que siga el flujo de confirmación y pago.
                    </p>
                  </div>
                </section>
              ) : null}

              {activeView === "chat" ? (
                <section className="auth-flow-panel client-dashboard-section">
                  <div className="panel-head client-dashboard-panel-head">
                    <h2>Chat con el cliente</h2>
                    <p>Deja todo por escrito dentro de la reserva para que el seguimiento sea claro.</p>
                  </div>

                  {booking && !canShareContactDetails(booking.status) ? (
                    <div className="client-booking-note">
                      <strong>Regla de seguridad del chat</strong>
                      <p>{PRE_CONFIRMATION_CHAT_BLOCK_MESSAGE}</p>
                    </div>
                  ) : null}

                  <BookingChatPanel
                    messages={messages}
                    currentUserId={taskerId}
                    chatBody={chatBody}
                    sending={sending}
                    inputPlaceholder="Escribe al cliente"
                    helperText="El cliente recibirá una notificación cuando le escribas desde esta reserva."
                    onChatBodyChange={setChatBody}
                    onSubmit={sendMessage}
                  />
                </section>
              ) : null}

              {activeView === "acciones" ? (
                <section className="auth-flow-panel client-dashboard-section">
                  <div className="panel-head client-dashboard-panel-head">
                    <h2>Acciones del servicio</h2>
                    <p>Llevá al cliente paso a paso. Avisar de salida, marcar llegada y cerrar el servicio.</p>
                  </div>

                  <BookingServiceActionsPanel
                    bookingId={booking.id}
                    status={booking.status as React.ComponentProps<typeof BookingServiceActionsPanel>["status"]}
                    paymentStatus={booking.paymentStatus}
                    onTheWayAt={booking.onTheWayAt}
                    checkInAt={booking.checkInAt}
                    checkOutAt={booking.checkOutAt}
                  />

                  <div className="tasker-booking-actions-card" style={{ marginTop: 16 }}>
                    <label>
                      Estado actual
                      <select value={statusValue} onChange={(event) => setStatusValue(event.target.value)}>
                        {TASKER_STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {STATUS_LABELS[status] ?? status}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="booking-actions">
                      <button className="cta" type="button" onClick={updateStatus} disabled={savingStatus}>
                        Guardar estado
                      </button>
                      <button className="cta ghost" type="button" onClick={completeBooking} disabled={savingStatus}>
                        Marcar servicio realizado
                      </button>
                    </div>
                  </div>

                  {booking.disputes && booking.disputes.length > 0 ? (
                    <div className="client-booking-note">
                      <strong>Hay un problema abierto en esta reserva</strong>
                      <p>
                        El cliente ya abrió un reporte en WeTask. Revisa el chat y espera la resolución antes de seguir con payout o
                        cierre manual.
                      </p>
                    </div>
                  ) : null}

                  <div className="client-booking-note">
                    <strong>Siguiente paso sugerido</strong>
                    <p>
                      Usa <em>Guardar estado</em> cuando estés coordinando o realizando la visita. Usa <em>Marcar servicio realizado</em>
                      cuando termines para que el cliente pueda confirmar o reportar un problema.
                    </p>
                  </div>

                  <div className="cta-row">
                    <Link className="cta ghost small" href="/pro?tab=reservas">
                      Volver a reservas
                    </Link>
                  </div>
                </section>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </main>
  );
}
