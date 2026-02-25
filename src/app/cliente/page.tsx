"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { MarketNav } from "@/components/market-nav";

type Booking = {
  id: string;
  status: string;
  scheduledAt: string;
  totalPriceClp: number;
  service: { name: string };
  pro: { fullName: string } | null;
};

type Notification = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
};

function clp(value: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value);
}

export default function ClientePage() {
  const [customerId, setCustomerId] = useState("");
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

  const fetchBookings = async (targetCustomerId: string) => {
    const response = await fetch(`/api/marketplace/client/bookings?customerId=${targetCustomerId}`);
    const data = (await response.json()) as { bookings?: Booking[]; error?: string; detail?: string };
    if (!response.ok || !data.bookings) throw new Error(data.detail || data.error || "No se pudieron cargar reservas");
    setBookings(data.bookings);
    return data.bookings.length;
  };

  const fetchNotifications = async (targetCustomerId: string) => {
    const response = await fetch(`/api/marketplace/notifications?userId=${targetCustomerId}`);
    const data = (await response.json()) as { notifications?: Notification[] };
    setNotifications(data.notifications ?? []);
  };

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const sessionRes = await fetch("/api/auth/session");
        const sessionData = (await sessionRes.json()) as {
          session?: { userId: string; fullName?: string | null };
          error?: string;
          detail?: string;
        };

        if (!sessionRes.ok || !sessionData.session?.userId) {
          throw new Error(sessionData.detail || sessionData.error || "No se pudo cargar sesion");
        }

        setCustomerId(sessionData.session.userId);
        const count = await fetchBookings(sessionData.session.userId);
        await fetchNotifications(sessionData.session.userId);
        setFeedback(`Panel cargado para ${sessionData.session.fullName ?? "cliente"} (${count} reservas).`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error inesperado");
      }
    };

    bootstrap();
  }, []);

  const loadBookings = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setFeedback("");
    try {
      const count = await fetchBookings(customerId);
      await fetchNotifications(customerId);
      setFeedback(`Reservas cargadas: ${count}`);
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
          <p>Mis reservas, proximas, historial, chat, reseña y soporte.</p>
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
            <h3>Soporte</h3>
            <p>Chat en app + centro de ayuda 24/7</p>
          </article>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Direcciones guardadas y favoritos (demo)</h2>
        </div>
        <div className="module-grid">
          <article className="module-card">
            <h3>Casa</h3>
            <p>Av. Providencia 1550, Providencia</p>
          </article>
          <article className="module-card">
            <h3>Favorito</h3>
            <p>Ana Gonzalez · Limpieza hogar</p>
          </article>
          <article className="module-card">
            <h3>Favorito</h3>
            <p>Camila Vera · Clases de piano</p>
          </article>
        </div>
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
            <Link className="cta small" href={`/cliente/reservas/${booking.id}`} target="_blank" rel="noreferrer">
              Abrir chat / acciones
            </Link>
          </article>
        ))}
      </section>

      {feedback ? <p className="feedback ok">{feedback}</p> : null}
      {error ? <p className="feedback error">{error}</p> : null}
    </main>
  );
}
