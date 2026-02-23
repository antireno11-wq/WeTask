"use client";

import { FormEvent, useEffect, useState } from "react";
import { MarketNav } from "@/components/market-nav";

type Booking = {
  id: string;
  status: string;
  paymentStatus: string;
  totalPriceClp: number;
  customer: { fullName: string };
  service: { name: string };
};

type Dispute = {
  id: string;
  status: string;
  reason: string;
  booking: { id: string; status: string };
};

export default function AdminPage() {
  const [adminId, setAdminId] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);

  const [categoryId, setCategoryId] = useState("");
  const [feePct, setFeePct] = useState(12);
  const [minHours, setMinHours] = useState(1);
  const [slotMinutes, setSlotMinutes] = useState(60);

  const [disputeId, setDisputeId] = useState("");
  const [resolution, setResolution] = useState("");
  const [refundAmount, setRefundAmount] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const response = await fetch("/api/auth/session");
        const data = (await response.json()) as { session?: { userId: string } | null };
        if (data.session?.userId) setAdminId(data.session.userId);
      } catch {
        // noop
      }
    };
    void bootstrap();
  }, []);

  const loadAll = async (event: FormEvent) => {
    event.preventDefault();
    setFeedback("");
    setError("");
    try {
      const [bookingsRes, disputesRes] = await Promise.all([
        fetch("/api/marketplace/bookings?limit=40"),
        fetch("/api/marketplace/admin/disputes")
      ]);

      const bookingsData = (await bookingsRes.json()) as { bookings?: Booking[]; error?: string; detail?: string };
      const disputesData = (await disputesRes.json()) as { disputes?: Dispute[]; error?: string; detail?: string };

      if (!bookingsRes.ok || !bookingsData.bookings) throw new Error(bookingsData.detail || bookingsData.error || "Error reservas");
      if (!disputesRes.ok || !disputesData.disputes) throw new Error(disputesData.detail || disputesData.error || "Error disputas");

      setBookings(bookingsData.bookings);
      setDisputes(disputesData.disputes);
      setFeedback("Datos admin cargados.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    }
  };

  const updateCategoryRules = async () => {
    setFeedback("");
    setError("");

    try {
      const response = await fetch("/api/marketplace/admin/categories/rules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId,
          basePlatformFeePct: feePct,
          minHours,
          slotMinutes
        })
      });

      const data = (await response.json()) as { category?: { id: string }; error?: string; detail?: string };
      if (!response.ok || !data.category) throw new Error(data.detail || data.error || "No se actualizaron reglas");
      setFeedback(`Reglas actualizadas para categoria ${data.category.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    }
  };

  const resolveDispute = async () => {
    if (!disputeId) return;

    setFeedback("");
    setError("");

    try {
      const response = await fetch("/api/marketplace/admin/disputes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          disputeId,
          resolution,
          refundAmountClp: refundAmount,
          status: "RESOLVED"
        })
      });

      const data = (await response.json()) as { dispute?: { id: string; status: string }; error?: string; detail?: string };
      if (!response.ok || !data.dispute) throw new Error(data.detail || data.error || "No se resolvio disputa");
      setFeedback(`Disputa ${data.dispute.id} resuelta.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    }
  };

  return (
    <main className="page market-shell">
      <MarketNav />

      <section className="panel">
        <div className="panel-head">
          <h2>Admin / Backoffice</h2>
          <p>Reservas, comisiones, reglas por categoria y disputas.</p>
        </div>

        <form className="query-row query-single" onSubmit={loadAll}>
          <label>
            Admin ID
            <input required value={adminId} onChange={(e) => setAdminId(e.target.value)} placeholder="cuid admin" />
          </label>
          <button className="cta ghost" type="submit">
            Cargar datos
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Reglas por categoria</h2>
        </div>
        <div className="query-row">
          <label>
            Category ID
            <input value={categoryId} onChange={(e) => setCategoryId(e.target.value)} />
          </label>
          <label>
            Comision %
            <input type="number" value={feePct} onChange={(e) => setFeePct(Number(e.target.value) || 0)} />
          </label>
          <label>
            Min horas
            <input type="number" value={minHours} onChange={(e) => setMinHours(Number(e.target.value) || 1)} />
          </label>
          <label>
            Slot minutos
            <select value={slotMinutes} onChange={(e) => setSlotMinutes(Number(e.target.value))}>
              <option value={30}>30</option>
              <option value={60}>60</option>
            </select>
          </label>
          <button className="cta small" type="button" onClick={updateCategoryRules}>
            Guardar
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Disputas</h2>
        </div>
        <div className="query-row">
          <label>
            Dispute ID
            <input value={disputeId} onChange={(e) => setDisputeId(e.target.value)} />
          </label>
          <label>
            Resolucion
            <input value={resolution} onChange={(e) => setResolution(e.target.value)} />
          </label>
          <label>
            Reembolso CLP
            <input type="number" min={0} value={refundAmount} onChange={(e) => setRefundAmount(Number(e.target.value) || 0)} />
          </label>
          <button className="cta small" type="button" onClick={resolveDispute}>
            Resolver
          </button>
        </div>

        <div className="list">
          {disputes.map((dispute) => (
            <article className="booking-card" key={dispute.id}>
              <p>
                <strong>{dispute.id}</strong> · {dispute.status}
              </p>
              <p>{dispute.reason}</p>
              <p>
                Reserva {dispute.booking.id} ({dispute.booking.status})
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Reservas</h2>
        </div>
        <div className="list">
          {bookings.map((booking) => (
            <article className="booking-card" key={booking.id}>
              <p>
                <strong>{booking.service.name}</strong> · {booking.status}
              </p>
              <p>
                Cliente: {booking.customer.fullName} · Pago: {booking.paymentStatus}
              </p>
              <p>Total: {booking.totalPriceClp}</p>
            </article>
          ))}
        </div>
      </section>

      {feedback ? <p className="feedback ok">{feedback}</p> : null}
      {error ? <p className="feedback error">{error}</p> : null}
    </main>
  );
}
