"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminHeroShell } from "@/components/admin-hero-shell";

type CleaningOnboardingItem = {
  id: string;
  status: "BORRADOR" | "PENDIENTE_REVISION" | "REQUIERE_CORRECCION" | "APROBADO" | "ACTIVO";
  currentStep: number;
  createdAt: string;
  baseCommune: string | null;
  serviceCommunes: unknown;
  referenceAddress: string | null;
  hourlyRateClp: number | null;
  minBookingHours: number | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  activatedAt: string | null;
  adminReviewNotes: string | null;
  profilePhotoUrl: string | null;
  identityDocumentFrontFile: string | null;
  identityDocumentBackFile: string | null;
  criminalRecordFile: string | null;
  user: {
    id: string;
    fullName: string;
    email: string;
    phone: string | null;
    professionalProfile: {
      isVerified: boolean;
      verificationStatus: string;
    } | null;
  };
};

type ActionType = "set_pending" | "request_correction" | "approve" | "activate" | "delete_record" | "clear_all";

const statusLabels: Record<CleaningOnboardingItem["status"], string> = {
  BORRADOR: "borrador",
  PENDIENTE_REVISION: "pendiente de revisión",
  REQUIERE_CORRECCION: "requiere corrección",
  APROBADO: "aprobado",
  ACTIVO: "activo"
};

const statusClasses: Record<CleaningOnboardingItem["status"], string> = {
  BORRADOR: "status-pending",
  PENDIENTE_REVISION: "status-pending",
  REQUIERE_CORRECCION: "status-cancelled",
  APROBADO: "status-completed",
  ACTIVO: "status-accepted"
};

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("es-CL");
}

function formatCommunes(value: unknown) {
  if (!Array.isArray(value)) return "-";
  const communes = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return communes.length ? communes.join(", ") : "-";
}

function daysInQueue(row: CleaningOnboardingItem): number | null {
  const reference = row.submittedAt ?? row.createdAt;
  if (!reference) return null;
  const ts = new Date(reference).getTime();
  if (Number.isNaN(ts)) return null;
  return Math.max(0, Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24)));
}

function queueBadge(days: number | null) {
  if (days === null) return null;
  if (days >= 5) return { label: `${days}d en cola`, className: "status-cancelled" };
  if (days >= 2) return { label: `${days}d en cola`, className: "status-pending" };
  return { label: days === 0 ? "Hoy" : `${days}d`, className: "status-completed" };
}

export default function AdminCleaningOnboardingPage() {
  const [rows, setRows] = useState<CleaningOnboardingItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [dateOrder, setDateOrder] = useState<"desc" | "asc">("desc");
  const [viewMode, setViewMode] = useState<"queue" | "validated">("queue");
  const [searchInput, setSearchInput] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const queueCount = rows.filter((row) =>
    ["BORRADOR", "PENDIENTE_REVISION", "REQUIERE_CORRECCION"].includes(row.status)
  ).length;
  const validatedCount = rows.filter((row) => ["APROBADO", "ACTIVO"].includes(row.status)).length;

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
        params.set("order", dateOrder);
        params.set("view", viewMode);
        if (searchTerm.trim()) params.set("q", searchTerm.trim());
        if (cursor) params.set("cursor", cursor);
        const query = params.toString() ? `?${params.toString()}` : "";
        const response = await fetch(`/api/admin/onboarding/cleaning${query}`);
        const data = (await response.json()) as {
          items?: CleaningOnboardingItem[];
          nextCursor?: string | null;
          error?: string;
          detail?: string;
        };
        if (!response.ok || !data.items) throw new Error(data.detail || data.error || "No se pudo cargar onboarding");
        setRows((current) => (append ? [...current, ...data.items!] : data.items!));
        setNextCursor(data.nextCursor ?? null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error inesperado");
      } finally {
        if (append) setLoadingMore(false);
        else setLoading(false);
      }
    },
    [dateOrder, searchTerm, statusFilter, viewMode]
  );

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [load, ready]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setStatusFilter(params.get("status") ?? "");
    setDateOrder(params.get("order") === "asc" ? "asc" : "desc");
    setViewMode(params.get("view") === "validated" ? "validated" : "queue");
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
    params.set("order", dateOrder);
    params.set("view", viewMode);
    if (searchTerm.trim()) params.set("q", searchTerm.trim());
    else params.delete("q");
    const query = params.toString();
    window.history.replaceState(null, "", query ? `${window.location.pathname}?${query}` : window.location.pathname);
  }, [dateOrder, ready, searchTerm, statusFilter, viewMode]);

  const handleViewChange = (nextView: "queue" | "validated") => {
    setViewMode(nextView);
    setStatusFilter("");
  };

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearchTerm(searchInput.trim());
  };

  const runAction = async (onboardingId: string, action: ActionType) => {
    if (action === "clear_all") {
      const confirmed = window.confirm(
        "Esto eliminará todas las inscripciones anteriores del backoffice y los perfiles profesionales asociados. ¿Quieres continuar?"
      );
      if (!confirmed) return;
    }
    if (action === "delete_record") {
      const confirmed = window.confirm("Esto eliminará el registro del onboarding y el perfil profesional asociado. ¿Quieres continuar?");
      if (!confirmed) return;
    }
    const notes = action === "request_correction" ? window.prompt("Escribe observaciones para corrección:", "") ?? "" : "";
    if (action === "request_correction" && !notes.trim()) {
      setError("Debes indicar la causa del rechazo o corrección.");
      setFeedback("");
      return;
    }
    setError("");
    setFeedback("");
    try {
      const response = await fetch("/api/admin/onboarding/cleaning", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "clear_all" ? { action } : { onboardingId, action, notes: notes.trim() || undefined })
      });
      const data = (await response.json()) as { ok?: boolean; error?: string; detail?: string };
      if (!response.ok || !data.ok) throw new Error(data.detail || data.error || "No se pudo aplicar accion");
      setFeedback("Accion aplicada correctamente");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    }
  };

  return (
    <AdminHeroShell>
      <div className="panel-head admin-page-head">
        <div>
          <span className="eyebrow">Validación de taskers</span>
          <h2>{viewMode === "validated" ? "Taskers validados" : "Cola de revisión manual"}</h2>
          <p>
            {viewMode === "validated"
              ? "Consulta taskers ya aprobados o activos sin mezclarlos con la cola pendiente."
              : "Revisa documentos, pide correcciones, aprueba perfiles y activa taskers desde un solo flujo interno."}
          </p>
        </div>
      </div>

      <div className="cta-row admin-view-toggle">
        <button
          type="button"
          className={`cta small ${viewMode === "queue" ? "active" : "ghost"}`}
          onClick={() => handleViewChange("queue")}
        >
          Cola de validación ({queueCount})
        </button>
        <button
          type="button"
          className={`cta small ${viewMode === "validated" ? "active" : "ghost"}`}
          onClick={() => handleViewChange("validated")}
        >
          Taskers validados ({validatedCount})
        </button>
      </div>

      <div className="cta-row admin-filter-bar">
        <label>
          Estado
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">Todos</option>
            {viewMode === "queue" ? (
              <>
                <option value="BORRADOR">Borrador</option>
                <option value="PENDIENTE_REVISION">Pendiente</option>
                <option value="REQUIERE_CORRECCION">Requiere corrección</option>
              </>
            ) : (
              <>
                <option value="APROBADO">Aprobado</option>
                <option value="ACTIVO">Activo</option>
              </>
            )}
          </select>
        </label>
        <form onSubmit={handleSearchSubmit} style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
          <input
            type="search"
            placeholder="Buscar por nombre, email, teléfono o RUT"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            style={{ padding: "8px 12px", borderRadius: 12, border: "1px solid #cdddee", minWidth: 280, font: "inherit" }}
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
        <button
          type="button"
          className="cta ghost small"
          onClick={() => setDateOrder((current) => (current === "desc" ? "asc" : "desc"))}
        >
          {dateOrder === "desc" ? "Más recientes primero" : "Más antiguas primero"}
        </button>
        <button type="button" className="cta ghost small admin-clear-button" onClick={() => void runAction("", "clear_all")}>
          Borrar inscripciones anteriores
        </button>
      </div>

      {loading ? <p className="empty">Cargando solicitudes...</p> : null}
      {error ? <p className="feedback error">{error}</p> : null}
      {feedback ? <p className="feedback ok">{feedback}</p> : null}
      {!loading && rows.length === 0 ? (
        <p className="empty">
          {viewMode === "validated" ? "Todavía no hay taskers validados en esta vista." : "No hay taskers pendientes en esta cola."}
        </p>
      ) : null}

      <div className="list">
        {rows.map((row) => {
          const days = daysInQueue(row);
          const badge = queueBadge(days);
          return (
          <article key={row.id} className="booking-card">
            <div className="booking-head">
              <h3>{row.user.fullName}</h3>
              <div style={{ display: "inline-flex", gap: 8, flexWrap: "wrap" }}>
                <span className={`status ${statusClasses[row.status]}`}>{statusLabels[row.status]}</span>
                {badge && viewMode === "queue" ? (
                  <span className={`status ${badge.className}`}>{badge.label}</span>
                ) : null}
              </div>
            </div>

            <p>
              <strong>Email:</strong> {row.user.email} · <strong>Teléfono:</strong> {row.user.phone ?? "-"}
            </p>
            <p>
              <strong>Comuna base:</strong> {row.baseCommune ?? "-"} · <strong>Dirección:</strong> {row.referenceAddress ?? "-"}
            </p>
            <p>
              <strong>Comunas de trabajo:</strong> {formatCommunes(row.serviceCommunes)}
            </p>
            <p>
              <strong>Tarifa:</strong> {row.hourlyRateClp ? `$${row.hourlyRateClp.toLocaleString("es-CL")}/h` : "-"} ·{" "}
              <strong>Mínimo:</strong> {row.minBookingHours ?? "-"} h · <strong>Paso:</strong> {row.currentStep}
            </p>
            <p>
              <strong>Inscrito:</strong> {formatDate(row.submittedAt ?? row.createdAt)} · <strong>Revisado:</strong> {formatDate(row.reviewedAt)} ·{" "}
              <strong>Activado:</strong> {formatDate(row.activatedAt)}
            </p>
            <p>
              <strong>Documentos:</strong>{" "}
              {[
                row.profilePhotoUrl ? "foto" : null,
                row.identityDocumentFrontFile ? "carnet frente" : null,
                row.identityDocumentBackFile ? "carnet reverso" : null,
                row.criminalRecordFile ? "antecedentes" : null
              ]
                .filter(Boolean)
                .join(", ") || "Faltan archivos"}
            </p>
            {row.adminReviewNotes ? (
              <p>
                <strong>Notas:</strong> {row.adminReviewNotes}
              </p>
            ) : null}

            <div className="cta-row">
              <Link href={`/admin/onboarding-limpieza/${row.id}`} className="cta ghost small">
                Ver ficha
              </Link>
              {row.status !== "ACTIVO" ? (
                <button type="button" className="cta ghost small" onClick={() => void runAction(row.id, "request_correction")}>
                  Pedir corrección
                </button>
              ) : null}
              {["BORRADOR", "PENDIENTE_REVISION", "REQUIERE_CORRECCION"].includes(row.status) ? (
                <button type="button" className="cta small" onClick={() => void runAction(row.id, "approve")}>
                  Aprobar
                </button>
              ) : null}
              {row.status === "APROBADO" ? (
                <button type="button" className="cta small" onClick={() => void runAction(row.id, "activate")}>
                  Activar
                </button>
              ) : null}
              <button type="button" className="cta ghost small" onClick={() => void runAction(row.id, "delete_record")}>
                Eliminar
              </button>
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
