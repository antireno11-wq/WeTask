"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminHeroShell } from "@/components/admin-hero-shell";

type PayoutStatus = "PENDING" | "PROCESSING" | "PAID" | "FAILED";

type PayoutListItem = {
  id: string;
  status: PayoutStatus;
  amountClp: number;
  updatedAt: string;
  pro: { id: string; fullName: string; email: string } | null;
  booking: {
    id: string;
    status: string;
    paymentStatus: string;
    totalPriceClp: number;
    scheduledAt: string;
    service: { name: string } | null;
    payment: { escrowStatus: string | null; providerStatus: string | null } | null;
  } | null;
};

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "FAILED,PROCESSING", label: "Requieren atención (FAILED + PROCESSING)" },
  { value: "FAILED", label: "Solo fallidos" },
  { value: "PROCESSING", label: "Solo en proceso" },
  { value: "PENDING", label: "Pendientes" },
  { value: "PAID", label: "Pagados" }
];

function clp(value: number) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value);
}

export default function AdminPayoutsPage() {
  const [filter, setFilter] = useState("FAILED,PROCESSING");
  const [payouts, setPayouts] = useState<PayoutListItem[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryingId, setRetryingId] = useState("");
  const [feedback, setFeedback] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/payouts?status=${encodeURIComponent(filter)}`, { cache: "no-store" });
      const data = (await res.json()) as { ok?: boolean; payouts?: PayoutListItem[]; counts?: Record<string, number>; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudieron cargar los payouts");
      setPayouts(data.payouts ?? []);
      setCounts(data.counts ?? {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const retry = async (payoutId: string) => {
    setRetryingId(payoutId);
    setFeedback("");
    setError("");
    try {
      const res = await fetch(`/api/admin/payouts/${payoutId}/retry`, { method: "POST" });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo reintentar");
      setFeedback("Payout reprocesado. Actualizando la lista...");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setRetryingId("");
    }
  };

  return (
    <AdminHeroShell>
      <div className="panel-head client-dashboard-panel-head">
        <h2>Cola de payouts</h2>
        <p>Payouts fallidos o atascados que requieren atención. Reintenta los que se trabaron por un error transitorio.</p>
      </div>
      <div className="admin-toolbar">
        <label>
          Filtrar por estado
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <div className="admin-badges">
          <span className="badge status-cancelled">FAILED: {counts.FAILED ?? 0}</span>
          <span className="badge status-accepted">PROCESSING: {counts.PROCESSING ?? 0}</span>
          <span className="badge">PENDING: {counts.PENDING ?? 0}</span>
          <span className="badge status-completed">PAID: {counts.PAID ?? 0}</span>
        </div>
        <button type="button" className="cta ghost small" onClick={() => void load()} disabled={loading}>
          {loading ? "Cargando..." : "Refrescar"}
        </button>
      </div>

      {error ? <p className="form-error">{error}</p> : null}
      {feedback ? <p className="form-feedback">{feedback}</p> : null}

      <div className="list client-dashboard-list">
        {loading ? (
          <p className="empty">Cargando payouts...</p>
        ) : payouts.length === 0 ? (
          <p className="empty">No hay payouts en este estado. 🎉</p>
        ) : (
          payouts.map((p) => (
            <article className="booking-card client-dashboard-card" key={p.id}>
              <div className="booking-head">
                <h3>{p.booking?.service?.name ?? "Servicio"}</h3>
                <span className={`status ${p.status === "FAILED" ? "status-cancelled" : p.status === "PAID" ? "status-completed" : "status-accepted"}`}>
                  {p.status}
                </span>
              </div>
              <p>
                <strong>Monto:</strong> {clp(p.amountClp)}
              </p>
              <p>
                <strong>Tasker:</strong> {p.pro?.fullName ?? "—"} ({p.pro?.email ?? "—"})
              </p>
              <p>
                <strong>Booking:</strong> {p.booking?.id ?? "—"} · estado {p.booking?.status ?? "—"} · pago {p.booking?.paymentStatus ?? "—"}
              </p>
              <p>
                <strong>Escrow:</strong> {p.booking?.payment?.escrowStatus ?? "—"} · MP {p.booking?.payment?.providerStatus ?? "—"}
              </p>
              <p>
                <strong>Actualizado:</strong> {new Date(p.updatedAt).toLocaleString("es-CL")}
              </p>
              <div className="booking-actions">
                <button
                  type="button"
                  className="cta small"
                  onClick={() => retry(p.id)}
                  disabled={retryingId === p.id || p.status === "PAID"}
                >
                  {retryingId === p.id ? "Reintentando..." : "Reintentar payout"}
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </AdminHeroShell>
  );
}
