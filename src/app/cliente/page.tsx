"use client";

import Link from "next/link";
import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import { MarketNav } from "@/components/market-nav";

type Booking = {
  id: string;
  status: string;
  scheduledAt: string;
  totalPriceClp: number;
  service: { name: string };
  pro: { fullName: string } | null;
  review?: { id: string } | null;
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

function clp(value: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value);
}

export default function ClientePage() {
  const [sessionUserId, setSessionUserId] = useState("");
  const [customerName, setCustomerName] = useState("Cliente");
  const [customerPhotoUrl, setCustomerPhotoUrl] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  const sortedBookings = useMemo(
    () => [...bookings].sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()),
    [bookings]
  );

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

  const statusClassByBooking = (status: string) => {
    if (status === "COMPLETED") return "status-completed";
    if (status === "CANCELLED" || status === "REFUNDED") return "status-cancelled";
    if (status === "ACCEPTED" || status === "IN_PROGRESS" || status === "ASSIGNED" || status === "CONFIRMED") {
      return "status-accepted";
    }
    return "status-pending";
  };

  return (
    <main className="page market-shell">
      <MarketNav />
      <section className="panel">
        <div className="panel-head">
          <h2>Panel Cliente</h2>
          <p>Mis reservas próximas, historial y estado de servicios.</p>
        </div>
        <div className="client-profile-box">
          <div className="client-photo-frame" aria-hidden>
            {customerPhotoUrl ? <img src={customerPhotoUrl} alt="Foto del cliente" className="client-photo-img" /> : <span>Sin foto</span>}
          </div>
          <div className="client-profile-copy">
            <h3>{customerName}</h3>
            <p>Este espacio muestra la foto de perfil del cliente.</p>
            <label className="client-photo-upload">
              Cargar foto
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handlePhotoChange} />
            </label>
            <button className="cta ghost small" type="button" onClick={() => void refreshDashboard()} disabled={!sessionUserId}>
              Actualizar servicios
            </button>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Notificaciones</h2>
        </div>
        <div className="list">
          {notifications.length === 0 ? (
            <p className="empty">Sin notificaciones por ahora.</p>
          ) : (
            notifications.map((item) => (
              <article className="booking-card" key={item.id}>
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

      <section className="panel">
        <div className="module-grid">
          <article className="module-card">
            <h3>Proximas</h3>
            <p>{upcomingBookings.length} reserva(s) programada(s)</p>
          </article>
          <article className="module-card">
            <h3>Historial</h3>
            <p>{historyBookings.length} servicio(s) realizado(s)</p>
          </article>
          <article className="module-card">
            <h3>Servicios</h3>
            <p>{bookings.length} servicio(s) en total</p>
          </article>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Servicios</h2>
          <p>Estado y detalle de tus reservas activas e históricas.</p>
        </div>
        <div className="list">
          {bookings.map((booking) => (
            <article className="booking-card" key={booking.id}>
              <div className="booking-head">
                <h3>{booking.service.name}</h3>
                <span className={`status ${statusClassByBooking(booking.status)}`}>{booking.status}</span>
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
              <div className="booking-actions">
                <Link className="cta small" href={`/cliente/reservas/${booking.id}`} target="_blank" rel="noreferrer">
                  Ver servicio
                </Link>
                {booking.status === "COMPLETED" ? (
                  booking.review?.id ? (
                    <button type="button" className="cta small cta-rating done" disabled>
                      Valorado
                    </button>
                  ) : (
                    <Link className="cta small cta-rating" href={`/cliente/reservas/${booking.id}`} target="_blank" rel="noreferrer">
                      Valorar
                    </Link>
                  )
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>

      {feedback ? <p className="feedback ok">{feedback}</p> : null}
      {error ? <p className="feedback error">{error}</p> : null}
    </main>
  );
}
