"use client";

import Link from "next/link";
import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import { MarketNav } from "@/components/market-nav";

type Booking = {
  id: string;
  status: string;
  scheduledAt: string;
  totalPriceClp: number;
  addressLine1: string;
  comuna: string;
  city: string | null;
  postalCode: string | null;
  service: { name: string };
  pro: { fullName: string } | null;
  review?: { id: string; rating: number; comment?: string | null } | null;
};

type Notification = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
};

type SessionPayload = {
  userId: string;
  fullName?: string | null;
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

function clp(value: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value);
}

function formatBookingDate(value: string) {
  return new Date(value).toLocaleString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function bookingEyebrow(status: string, scheduledAt: string) {
  if (status === "COMPLETED") return "Servicio realizado";
  if (status === "IN_PROGRESS") return "Servicio en curso";
  if (new Date(scheduledAt).getTime() >= Date.now()) return "Próxima visita";
  return "Servicio agendado";
}

export default function ClientePage() {
  const [sessionUserId, setSessionUserId] = useState("");
  const [customerName, setCustomerName] = useState("Cliente");
  const [customerPhotoUrl, setCustomerPhotoUrl] = useState("");
  const [customAddress, setCustomAddress] = useState("");
  const [addressDraft, setAddressDraft] = useState("");
  const [editingAddress, setEditingAddress] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  const sortedBookings = useMemo(
    () => [...bookings].sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()),
    [bookings]
  );
  const defaultAddress = useMemo(() => {
    const latestWithAddress = bookings.find((item) => item.addressLine1?.trim());
    if (!latestWithAddress) return "Aun no tienes una direccion guardada.";

    return [latestWithAddress.addressLine1, latestWithAddress.comuna, latestWithAddress.city]
      .filter((value) => typeof value === "string" && value.trim().length > 0)
      .join(", ");
  }, [bookings]);
  const displayedAddress = customAddress.trim() || defaultAddress;

  const upcomingBookings = sortedBookings.filter((item) => new Date(item.scheduledAt).getTime() >= Date.now());
  const historyBookings = sortedBookings.filter((item) => new Date(item.scheduledAt).getTime() < Date.now());

  const fetchBookings = async () => {
    const response = await fetch("/api/marketplace/client/bookings");
    const data = (await response.json()) as { bookings?: Booking[]; error?: string; detail?: string };
    if (!response.ok || !data.bookings) throw new Error(data.detail || data.error || "No se pudieron cargar reservas");
    setBookings(data.bookings);
    return data.bookings.length;
  };

  const fetchNotifications = async () => {
    const response = await fetch("/api/marketplace/notifications");
    const data = (await response.json()) as { notifications?: Notification[] };
    setNotifications(data.notifications ?? []);
  };

  const loadDashboard = useCallback(async (targetName: string) => {
    const count = await fetchBookings();
    await fetchNotifications();
    setFeedback(`Panel cargado para ${targetName} (${count} reservas).`);
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const sessionRes = await fetch("/api/auth/session");
        const sessionData = (await sessionRes.json()) as {
          session?: SessionPayload;
          error?: string;
          detail?: string;
        };

        if (!sessionRes.ok || !sessionData.session?.userId) {
          throw new Error(sessionData.detail || sessionData.error || "No se pudo cargar sesion");
        }

        const nextName = sessionData.session.fullName?.trim() || "Cliente";
        setSessionUserId(sessionData.session.userId);
        setCustomerName(nextName);
        await loadDashboard(nextName);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error inesperado");
      }
    };

    bootstrap();
  }, [loadDashboard]);

  useEffect(() => {
    try {
      const savedPhoto = window.localStorage.getItem("wetask_customer_photo") ?? "";
      if (savedPhoto) setCustomerPhotoUrl(savedPhoto);
      const savedAddress = window.localStorage.getItem("wetask_customer_address") ?? "";
      if (savedAddress) {
        setCustomAddress(savedAddress);
        setAddressDraft(savedAddress);
      }
    } catch {
      // Ignorar errores de almacenamiento local.
    }
  }, []);

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const next = typeof reader.result === "string" ? reader.result : "";
      setCustomerPhotoUrl(next);
      try {
        window.localStorage.setItem("wetask_customer_photo", next);
      } catch {
        // Ignorar errores de almacenamiento local.
      }
    };
    reader.readAsDataURL(file);
  };

  const refreshDashboard = async () => {
    setError("");
    setFeedback("");
    try {
      await loadDashboard(customerName);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    }
  };

  const saveAddress = () => {
    const nextAddress = addressDraft.trim();
    if (!nextAddress) {
      setError("Ingresa una dirección antes de guardar.");
      return;
    }
    setCustomAddress(nextAddress);
    setEditingAddress(false);
    setFeedback("Dirección actualizada en tu panel.");
    setError("");
    try {
      window.localStorage.setItem("wetask_customer_address", nextAddress);
    } catch {
      // noop
    }
  };

  const statusClassByBooking = (status: string) => {
    if (status === "COMPLETED") return "status-completed";
    if (status === "CANCELLED" || status === "REFUNDED") return "status-cancelled";
    if (status === "ACCEPTED" || status === "IN_PROGRESS" || status === "ASSIGNED" || status === "CONFIRMED") {
      return "status-accepted";
    }
    return "status-pending";
  };
  const statusLabelByBooking = (status: string) => STATUS_LABELS[status] ?? status;

  return (
    <main className="auth-flow-screen auth-flow-screen-scroll market-shell-auth">
      <div className="auth-flow-backdrop" aria-hidden />

      <div className="login-screen-content market-shell-auth-content">
        <MarketNav />

        <section className="auth-flow-shell auth-flow-shell-wide client-dashboard-hero">
          <div className="auth-flow-copy client-dashboard-copy">
            <p className="auth-flow-kicker">Panel cliente</p>
            <h1>Gestiona tus reservas con el mismo look de WeTask.</h1>
            <p>Revisa tus próximas visitas, historial, avisos importantes y vuelve a reservar en segundos desde un solo panel.</p>

            <div className="auth-flow-copy-list client-dashboard-summary">
              <div className="auth-flow-meta-card">
                <strong>Próximas reservas</strong>
                <span>{upcomingBookings.length} servicio(s) programado(s).</span>
              </div>
              <div className="auth-flow-meta-card">
                <strong>Historial</strong>
                <span>{historyBookings.length} servicio(s) completados o pasados.</span>
              </div>
              <div className="auth-flow-meta-card">
                <strong>Notificaciones</strong>
                <span>{notifications.length} aviso(s) disponible(s) para revisar.</span>
              </div>
            </div>

            <div className="auth-flow-actions">
              <Link href="/solicitar-tecnico" className="cta">
                Buscar servicio
              </Link>
              <button className="cta ghost" type="button" onClick={() => void refreshDashboard()} disabled={!sessionUserId}>
                Actualizar panel
              </button>
            </div>
          </div>

          <section className="auth-flow-panel auth-flow-panel-wide client-dashboard-profile-panel">
            <div className="panel-head client-dashboard-panel-head">
              <h2>Tu perfil</h2>
              <p>Tu foto y accesos rápidos del lado cliente.</p>
            </div>

            <div className="client-profile-box client-profile-box-auth">
              <div className="client-photo-frame" aria-hidden>
                {customerPhotoUrl ? <img src={customerPhotoUrl} alt="Foto del cliente" className="client-photo-img" /> : <span>Sin foto</span>}
              </div>
              <div className="client-profile-copy">
                <h3>{customerName}</h3>
                <p>Direccion por defecto</p>
                <strong className="client-profile-address">{displayedAddress}</strong>
                {editingAddress ? (
                  <div className="client-address-editor">
                    <input value={addressDraft} onChange={(event) => setAddressDraft(event.target.value)} placeholder="Ingresa tu dirección" />
                    <div className="client-profile-actions">
                      <button className="cta small" type="button" onClick={saveAddress}>
                        Guardar dirección
                      </button>
                      <button
                        className="cta ghost small"
                        type="button"
                        onClick={() => {
                          setAddressDraft(displayedAddress);
                          setEditingAddress(false);
                        }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : null}
                {!customerPhotoUrl ? (
                  <label className="client-photo-upload">
                    Cargar foto
                    <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handlePhotoChange} />
                  </label>
                ) : null}
                <div className="client-profile-actions">
                  <button className="cta ghost small" type="button" onClick={() => setEditingAddress((current) => !current)}>
                    Editar dirección
                  </button>
                  <Link className="cta small" href="/services">
                    Explorar servicios
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </section>

        <div className="page client-dashboard-sections">
          {feedback ? <p className="feedback ok">{feedback}</p> : null}
          {error ? <p className="feedback error">{error}</p> : null}

          <section className="auth-flow-panel client-dashboard-section">
            <div className="panel-head client-dashboard-panel-head">
              <h2>Resumen rápido</h2>
              <p>Tu actividad actual dentro de la plataforma.</p>
            </div>
            <div className="module-grid client-dashboard-metrics">
              <article className="module-card client-dashboard-metric">
                <h3>Próximas</h3>
                <p>{upcomingBookings.length} reserva(s) programada(s)</p>
              </article>
              <article className="module-card client-dashboard-metric">
                <h3>Historial</h3>
                <p>{historyBookings.length} servicio(s) realizado(s)</p>
              </article>
              <article className="module-card client-dashboard-metric">
                <h3>Servicios</h3>
                <p>{bookings.length} servicio(s) en total</p>
              </article>
            </div>
          </section>

          <section className="auth-flow-panel client-dashboard-section">
            <div className="panel-head client-dashboard-panel-head">
              <h2>Notificaciones</h2>
              <p>Mensajes y actualizaciones sobre tus reservas.</p>
            </div>
            <div className="list client-dashboard-list">
              {notifications.length === 0 ? (
                <p className="empty">Sin notificaciones por ahora.</p>
              ) : (
                notifications.map((item) => (
                  <article className="booking-card client-dashboard-card" key={item.id}>
                    <p>
                      <strong>{item.title}</strong>
                    </p>
                    <p>{item.body}</p>
                    <p>{new Date(item.createdAt).toLocaleString("es-ES")}</p>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="auth-flow-panel client-dashboard-section">
            <div className="panel-head client-dashboard-panel-head">
              <h2>Servicios</h2>
              <p>Estado y detalle de tus reservas activas e históricas.</p>
            </div>
            <div className="list client-dashboard-list">
              {bookings.length === 0 ? (
                <p className="empty">Todavía no tienes reservas. Cuando hagas la primera, aparecerá aquí.</p>
              ) : (
                bookings.map((booking) => (
                  <article className="booking-card client-dashboard-card" key={booking.id}>
                    <div className="booking-head">
                      <h3>{booking.service.name}</h3>
                      <span className={`status ${statusClassByBooking(booking.status)}`}>{statusLabelByBooking(booking.status)}</span>
                    </div>
                    <p className="client-booking-eyebrow">{bookingEyebrow(booking.status, booking.scheduledAt)}</p>
                    <p>
                      <strong>Fecha:</strong> {formatBookingDate(booking.scheduledAt)}
                    </p>
                    <p>
                      <strong>Profesional:</strong> {booking.pro?.fullName ?? "Pendiente"}
                    </p>
                    <p>
                      <strong>Ubicación:</strong> {[booking.addressLine1, booking.comuna, booking.city].filter(Boolean).join(", ")}
                    </p>
                    <p>
                      <strong>Total:</strong> {clp(booking.totalPriceClp)}
                    </p>
                    {booking.review?.id ? (
                      <p className="client-booking-review-line">
                        <strong>Valoración:</strong> {booking.review.rating}/5 estrellas
                      </p>
                    ) : null}
                    <div className="booking-actions">
                      <Link className="cta small" href={`/cliente/reservas/${booking.id}`}>
                        Ver servicio
                      </Link>
                      {booking.status === "COMPLETED" ? (
                        booking.review?.id ? (
                          <button type="button" className="cta small cta-rating done" disabled>
                            Valorado
                          </button>
                        ) : (
                          <Link className="cta small cta-rating" href={`/cliente/reservas/${booking.id}`}>
                            Valorar
                          </Link>
                        )
                      ) : null}
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
