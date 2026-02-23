"use client";

import { FormEvent, useState } from "react";
import { MarketNav } from "@/components/market-nav";

const statusOptions = ["ACCEPTED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

type Booking = {
  id: string;
  status: string;
  scheduledAt: string;
  totalPriceClp: number;
  customer: { fullName: string; email: string };
  service: { name: string };
  payout: { status: string } | null;
};

function clp(value: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value);
}

export default function ProPage() {
  const [proId, setProId] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [statusByBooking, setStatusByBooking] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  const headers = {
    "Content-Type": "application/json",
    "x-user-id": proId,
    "x-user-role": "PRO"
  };

  const loadBookings = async (event: FormEvent) => {
    event.preventDefault();
    setFeedback("");
    setError("");

    try {
      const response = await fetch(`/api/marketplace/pro/bookings?proId=${proId}`, { headers });
      const data = (await response.json()) as { bookings?: Booking[]; error?: string; detail?: string };
      if (!response.ok || !data.bookings) throw new Error(data.detail || data.error || "No se pudo cargar reservas");
      setBookings(data.bookings);
      const next: Record<string, string> = {};
      data.bookings.forEach((item) => {
        next[item.id] = item.status;
      });
      setStatusByBooking(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    }
  };

  const updateStatus = async (bookingId: string) => {
    setFeedback("");
    setError("");

    try {
      const response = await fetch(`/api/marketplace/bookings/${bookingId}/status`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status: statusByBooking[bookingId] })
      });
      const data = (await response.json()) as { booking?: { id: string; status: string }; error?: string; detail?: string };
      if (!response.ok || !data.booking) throw new Error(data.detail || data.error || "No se pudo actualizar estado");
      setBookings((prev) => prev.map((item) => (item.id === bookingId ? { ...item, status: data.booking!.status } : item)));
      setFeedback(`Estado actualizado: ${data.booking.status}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    }
  };

  const completeBooking = async (bookingId: string) => {
    setFeedback("");
    setError("");
    try {
      const response = await fetch(`/api/marketplace/bookings/${bookingId}/complete`, {
        method: "POST",
        headers
      });
      const data = (await response.json()) as { booking?: { status: string }; error?: string; detail?: string };
      if (!response.ok || !data.booking) throw new Error(data.detail || data.error || "No se pudo finalizar reserva");
      setBookings((prev) => prev.map((item) => (item.id === bookingId ? { ...item, status: data.booking!.status } : item)));
      setFeedback("Reserva finalizada.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    }
  };

  const requestPayout = async (bookingId: string) => {
    setFeedback("");
    setError("");
    try {
      const response = await fetch(`/api/marketplace/bookings/${bookingId}/payout/request`, {
        method: "POST",
        headers
      });
      const data = (await response.json()) as { payout?: { id: string; status: string }; error?: string; detail?: string };
      if (!response.ok || !data.payout) throw new Error(data.detail || data.error || "No se pudo solicitar payout");
      setFeedback(`Payout solicitado: ${data.payout.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    }
  };

  return (
    <main className="page market-shell">
      <MarketNav />
      <section className="panel">
        <div className="panel-head">
          <h2>Panel Profesional</h2>
          <p>Reservas, estados y payouts.</p>
        </div>

        <form className="query-row query-single" onSubmit={loadBookings}>
          <label>
            Pro ID
            <input required value={proId} onChange={(e) => setProId(e.target.value)} placeholder="cuid profesional" />
          </label>
          <button type="submit" className="cta ghost">
            Cargar agenda
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
              <strong>Cliente:</strong> {booking.customer.fullName} ({booking.customer.email})
            </p>
            <p>
              <strong>Fecha:</strong> {new Date(booking.scheduledAt).toLocaleString("es-ES")}
            </p>
            <p>
              <strong>Total:</strong> {clp(booking.totalPriceClp)}
            </p>
            <p>
              <strong>Payout:</strong> {booking.payout?.status ?? "No solicitado"}
            </p>
            <div className="status-editor">
              <label>
                Estado
                <select
                  value={statusByBooking[booking.id] ?? booking.status}
                  onChange={(e) => setStatusByBooking((prev) => ({ ...prev, [booking.id]: e.target.value }))}
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <button className="cta small" type="button" onClick={() => updateStatus(booking.id)}>
                Guardar estado
              </button>
              <button className="cta ghost small" type="button" onClick={() => completeBooking(booking.id)}>
                Finalizar
              </button>
              <button className="cta ghost small" type="button" onClick={() => requestPayout(booking.id)}>
                Solicitar payout
              </button>
            </div>
          </article>
        ))}
      </section>

      {feedback ? <p className="feedback ok">{feedback}</p> : null}
      {error ? <p className="feedback error">{error}</p> : null}
    </main>
  );
}
