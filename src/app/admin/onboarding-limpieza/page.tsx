"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminHeroShell } from "@/components/admin-hero-shell";

type CleaningOnboardingItem = {
  id: string;
  status: "BORRADOR" | "PENDIENTE_REVISION" | "REQUIERE_CORRECCION" | "APROBADO" | "ACTIVO";
  currentStep: number;
  createdAt: string;
  baseCommune: string | null;
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

export default function AdminCleaningOnboardingPage() {
  const [rows, setRows] = useState<CleaningOnboardingItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [dateOrder, setDateOrder] = useState<"desc" | "asc">("desc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const pendingCount = rows.filter((row) => row.status === "PENDIENTE_REVISION").length;
  const correctionCount = rows.filter((row) => row.status === "REQUIERE_CORRECCION").length;
  const activeCount = rows.filter((row) => row.status === "ACTIVO").length;

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const search = new URLSearchParams();
      if (statusFilter) search.set("status", statusFilter);
      search.set("order", dateOrder);
      const query = search.toString() ? `?${search.toString()}` : "";
      const response = await fetch(`/api/admin/onboarding/cleaning${query}`);
      const data = (await response.json()) as { items?: CleaningOnboardingItem[]; error?: string; detail?: string };
      if (!response.ok || !data.items) throw new Error(data.detail || data.error || "No se pudo cargar onboarding");
      setRows(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [statusFilter]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setStatusFilter(params.get("status") ?? "");
    setDateOrder(params.get("order") === "asc" ? "asc" : "desc");
  }, []);

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
          <h2>Cola de revisión manual</h2>
          <p>Revisa documentos, pide correcciones, aprueba perfiles y activa taskers desde un solo flujo interno.</p>
        </div>
      </div>

      <div className="cta-row admin-filter-bar">
        <label>
          Estado
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">Todos</option>
            <option value="BORRADOR">Borrador</option>
            <option value="PENDIENTE_REVISION">Pendiente</option>
            <option value="REQUIERE_CORRECCION">Requiere corrección</option>
            <option value="APROBADO">Aprobado</option>
            <option value="ACTIVO">Activo</option>
          </select>
        </label>
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

      <div className="list">
        {rows.map((row) => (
          <article key={row.id} className="booking-card">
            <div className="booking-head">
              <h3>{row.user.fullName}</h3>
              <span className={`status ${statusClasses[row.status]}`}>{statusLabels[row.status]}</span>
            </div>

            <p>
              <strong>Email:</strong> {row.user.email} · <strong>Teléfono:</strong> {row.user.phone ?? "-"}
            </p>
            <p>
              <strong>Comuna base:</strong> {row.baseCommune ?? "-"} · <strong>Dirección:</strong> {row.referenceAddress ?? "-"}
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
              <button type="button" className="cta ghost small" onClick={() => void runAction(row.id, "request_correction")}>
                Rechazar
              </button>
              <button type="button" className="cta small" onClick={() => void runAction(row.id, "approve")}>
                Aprobar
              </button>
              <button type="button" className="cta small" onClick={() => void runAction(row.id, "activate")}>
                Activar
              </button>
              <button type="button" className="cta ghost small" onClick={() => void runAction(row.id, "delete_record")}>
                Eliminar
              </button>
            </div>
          </article>
        ))}
      </div>
    </AdminHeroShell>
  );
}
