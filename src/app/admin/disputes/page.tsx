"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminHeroShell } from "@/components/admin-hero-shell";

type DisputeStatus = "OPEN" | "IN_REVIEW" | "RESOLVED" | "CLOSED";

type DisputeListItem = {
  id: string;
  status: DisputeStatus;
  reason: string;
  category: string | null;
  refundAmountClp: number | null;
  resolution: string | null;
  dueDateAt: string | null;
  createdAt: string;
  resolvedAt: string | null;
  refundedAt: string | null;
  booking: {
    id: string;
    status: string;
    paymentStatus: string;
    totalPriceClp: number;
    scheduledAt: string;
    customer: { id: string; fullName: string; email: string };
    pro: { id: string; fullName: string; email: string } | null;
    service: { name: string } | null;
  };
};

const statusLabel: Record<DisputeStatus, string> = {
  OPEN: "Abierta",
  IN_REVIEW: "En revisión",
  RESOLVED: "Resuelta",
  CLOSED: "Cerrada"
};

const statusClass: Record<DisputeStatus, string> = {
  OPEN: "status-cancelled",
  IN_REVIEW: "status-pending",
  RESOLVED: "status-completed",
  CLOSED: "status-accepted"
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("es-CL");
}

function formatMoney(value: number | null) {
  if (value === null || value === undefined) return "—";
  return `$${value.toLocaleString("es-CL")}`;
}

function slaBadge(dispute: DisputeListItem): { label: string; className: string } | null {
  if (dispute.status === "RESOLVED" || dispute.status === "CLOSED") return null;
  if (!dispute.dueDateAt) return null;
  const due = new Date(dispute.dueDateAt).getTime();
  const now = Date.now();
  const hoursLeft = (due - now) / (1000 * 60 * 60);
  if (hoursLeft < 0) {
    const daysOver = Math.floor(-hoursLeft / 24);
    return { label: `Vencida hace ${daysOver}d`, className: "status-cancelled" };
  }
  if (hoursLeft < 24) {
    return { label: `Vence en <24h`, className: "status-pending" };
  }
  const daysLeft = Math.floor(hoursLeft / 24);
  return { label: `Vence en ${daysLeft}d`, className: "status-completed" };
}

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState<DisputeListItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("OPEN");
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(
    async (options?: { cursor?: string | null; append?: boolean }) => {
      const cursor = options?.cursor ?? null;
      const append = Boolean(options?.append);
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        if (statusFilter) params.set("status", statusFilter);
        if (searchTerm.trim()) params.set("q", searchTerm.trim());
        if (cursor) params.set("cursor", cursor);
        const response = await fetch(`/api/marketplace/admin/disputes?${params.toString()}`);
        const data = (await response.json()) as {
          disputes?: DisputeListItem[];
          nextCursor?: string | null;
          error?: string;
          detail?: string;
        };
        if (!response.ok || !data.disputes) throw new Error(data.detail || data.error || "No se pudieron cargar disputas");
        setDisputes((current) => (append ? [...current, ...data.disputes!] : data.disputes!));
        setNextCursor(data.nextCursor ?? null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error inesperado");
      } finally {
        if (append) setLoadingMore(false);
        else setLoading(false);
      }
    },
    [searchTerm, statusFilter]
  );

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [load, ready]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setStatusFilter(params.get("status") ?? "OPEN");
    const initialSearch = params.get("q") ?? "";
    setSearchInput(initialSearch);
    setSearchTerm(initialSearch);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (statusFilter) params.set("status", statusFilter);
    else params.delete("status");
    if (searchTerm.trim()) params.set("q", searchTerm.trim());
    else params.delete("q");
    const query = params.toString();
    window.history.replaceState(null, "", query ? `${window.location.pathname}?${query}` : window.location.pathname);
  }, [ready, searchTerm, statusFilter]);

  const onSubmitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearchTerm(searchInput.trim());
  };

  return (
    <AdminHeroShell>
      <div className="panel-head admin-page-head">
        <div>
          <span className="eyebrow">Reclamos y disputas</span>
          <h2>Cola de resolución</h2>
          <p>Revisa los reclamos abiertos, valida evidencia y emite reembolsos reales contra MercadoPago.</p>
        </div>
      </div>

      <div className="cta-row admin-filter-bar">
        <label>
          Estado
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">Todos</option>
            <option value="OPEN">Abiertas</option>
            <option value="IN_REVIEW">En revisión</option>
            <option value="RESOLVED">Resueltas</option>
            <option value="CLOSED">Cerradas</option>
          </select>
        </label>
        <form onSubmit={onSubmitSearch} style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
          <input
            type="search"
            placeholder="Buscar por motivo, cliente, profesional o booking id"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            style={{ padding: "8px 12px", borderRadius: 12, border: "1px solid #cdddee", minWidth: 320, font: "inherit" }}
          />
          <button type="submit" className="cta small">
            Buscar
          </button>
          {searchTerm ? (
            <button
              type="button"
              className="cta ghost small"
              onClick={() => {
                setSearchInput("");
                setSearchTerm("");
              }}
            >
              Limpiar
            </button>
          ) : null}
        </form>
      </div>

      {loading ? <p className="empty">Cargando reclamos...</p> : null}
      {error ? <p className="feedback error">{error}</p> : null}
      {!loading && disputes.length === 0 ? <p className="empty">No hay reclamos para este filtro.</p> : null}

      <div className="list">
        {disputes.map((d) => {
          const sla = slaBadge(d);
          return (
            <article key={d.id} className="booking-card">
              <div className="booking-head">
                <h3>
                  {d.booking.customer.fullName} <span style={{ opacity: 0.6, fontWeight: 400 }}>vs {d.booking.pro?.fullName ?? "—"}</span>
                </h3>
                <div style={{ display: "inline-flex", gap: 8, flexWrap: "wrap" }}>
                  <span className={`status ${statusClass[d.status]}`}>{statusLabel[d.status]}</span>
                  {sla ? <span className={`status ${sla.className}`}>{sla.label}</span> : null}
                </div>
              </div>
              <p>
                <strong>Servicio:</strong> {d.booking.service?.name ?? "—"} · <strong>Reserva:</strong> {d.booking.id} ·{" "}
                <strong>Monto:</strong> {formatMoney(d.booking.totalPriceClp)}
              </p>
              <p>
                <strong>Motivo:</strong> {d.reason}
              </p>
              {d.category ? (
                <p>
                  <strong>Categoría:</strong> {d.category}
                </p>
              ) : null}
              <p>
                <strong>Abierta:</strong> {formatDate(d.createdAt)}
                {d.dueDateAt ? (
                  <>
                    {" · "}
                    <strong>Vence:</strong> {formatDate(d.dueDateAt)}
                  </>
                ) : null}
                {d.resolvedAt ? (
                  <>
                    {" · "}
                    <strong>Resuelta:</strong> {formatDate(d.resolvedAt)}
                  </>
                ) : null}
              </p>
              {d.refundAmountClp ? (
                <p>
                  <strong>Reembolso registrado:</strong> {formatMoney(d.refundAmountClp)}{" "}
                  {d.refundedAt ? `(procesado ${formatDate(d.refundedAt)})` : ""}
                </p>
              ) : null}
              {d.resolution ? (
                <p>
                  <strong>Resolución:</strong> {d.resolution}
                </p>
              ) : null}
              <div className="cta-row">
                <Link href={`/admin/disputes/${d.id}`} className="cta small">
                  Abrir ficha
                </Link>
                <Link href={`/admin/users/${d.booking.customer.id}`} className="cta ghost small">
                  Ver cliente
                </Link>
                {d.booking.pro ? (
                  <Link href={`/admin/users/${d.booking.pro.id}`} className="cta ghost small">
                    Ver profesional
                  </Link>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      {nextCursor ? (
        <div className="cta-row" style={{ justifyContent: "center", marginTop: 24 }}>
          <button
            type="button"
            className="cta ghost"
            onClick={() => void load({ cursor: nextCursor, append: true })}
            disabled={loadingMore}
          >
            {loadingMore ? "Cargando..." : "Cargar más"}
          </button>
        </div>
      ) : null}
    </AdminHeroShell>
  );
}
