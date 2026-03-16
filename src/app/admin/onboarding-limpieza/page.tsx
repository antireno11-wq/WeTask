"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminHeroShell } from "@/components/admin-hero-shell";

type CleaningOnboardingItem = {
  id: string;
  status: "BORRADOR" | "PENDIENTE_REVISION" | "REQUIERE_CORRECCION" | "APROBADO" | "ACTIVO";
  currentStep: number;
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

type ActionType = "set_pending" | "request_correction" | "approve" | "activate";

const statusLabels: Record<CleaningOnboardingItem["status"], string> = {
  BORRADOR: "borrador",
  PENDIENTE_REVISION: "pendiente de revision",
  REQUIERE_CORRECCION: "requiere correccion",
  APROBADO: "aprobado",
  ACTIVO: "activo"
};

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("es-CL");
}

export default function AdminCleaningOnboardingPage() {
  const [rows, setRows] = useState<CleaningOnboardingItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("");
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
      const query = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : "";
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

  const runAction = async (onboardingId: string, action: ActionType) => {
    const notes = action === "request_correction" ? window.prompt("Escribe observaciones para correccion:", "") ?? "" : "";
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
        body: JSON.stringify({ onboardingId, action, notes: notes.trim() || undefined })
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
    <AdminHeroShell
      copy={
        <>
          <span className="auth-flow-kicker">Revisión manual</span>
          <h1>Revisa cada tasker con el mismo diseño del resto de WeTask.</h1>
          <p>Este flujo está pensado para que tu equipo vea rápido documentos, estado del onboarding, tarifa, cobertura y acciones pendientes antes de aprobar o rechazar.</p>

          <div className="auth-flow-copy-list admin-copy-list">
            <article className="auth-flow-meta-card">
              <strong>{pendingCount} pendientes</strong>
              <span>Perfiles listos para revisión documental y decisión.</span>
            </article>
            <article className="auth-flow-meta-card">
              <strong>{correctionCount} con correcciones</strong>
              <span>Solicitudes que necesitan nuevos archivos o ajustes.</span>
            </article>
            <article className="auth-flow-meta-card">
              <strong>{activeCount} activos</strong>
              <span>Taskers que ya terminaron el proceso y están operativos.</span>
            </article>
          </div>

          <div className="auth-flow-inline-links">
            <Link href="/admin">Volver al backoffice</Link>
            <Link href="/admin/team">Ver equipo interno</Link>
          </div>

          <div className="auth-flow-status">
            <strong>{rows.length} solicitud(es) en esta vista</strong>
            <span>Usa el filtro por estado para concentrarte en pendientes, aprobados o perfiles ya activos.</span>
          </div>
        </>
      }
    >
      <div className="panel-head admin-page-head">
        <div>
          <span className="eyebrow">Validación de profesionales</span>
          <h2>Cola de revisión manual</h2>
          <p>Revisa documentos, pide correcciones, aprueba perfiles y activa taskers desde un solo flujo interno.</p>
        </div>
        <Link href="/admin/team" className="cta ghost small">
          Ver equipo interno
        </Link>
      </div>

      <div className="cta-row admin-filter-bar">
        <label>
          Estado
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">Todos</option>
            <option value="BORRADOR">Borrador</option>
            <option value="PENDIENTE_REVISION">Pendiente</option>
            <option value="REQUIERE_CORRECCION">Requiere correccion</option>
            <option value="APROBADO">Aprobado</option>
            <option value="ACTIVO">Activo</option>
          </select>
        </label>
      </div>

      {loading ? <p className="empty">Cargando solicitudes...</p> : null}
      {error ? <p className="feedback error">{error}</p> : null}
      {feedback ? <p className="feedback ok">{feedback}</p> : null}

      <div className="list">
        {rows.map((row) => (
          <article key={row.id} className="booking-card">
            <div className="booking-head">
              <h3>{row.user.fullName}</h3>
              <span className={`status status-${statusLabels[row.status].replace(/\s+/g, "-")}`}>{statusLabels[row.status]}</span>
            </div>

            <p>
              <strong>Email:</strong> {row.user.email} · <strong>Telefono:</strong> {row.user.phone ?? "-"}
            </p>
            <p>
              <strong>Comuna base:</strong> {row.baseCommune ?? "-"} · <strong>Dirección:</strong> {row.referenceAddress ?? "-"}
            </p>
            <p>
              <strong>Tarifa:</strong> {row.hourlyRateClp ? `$${row.hourlyRateClp.toLocaleString("es-CL")}/h` : "-"} ·{" "}
              <strong>Minimo:</strong> {row.minBookingHours ?? "-"} h · <strong>Paso:</strong> {row.currentStep}
            </p>
            <p>
              <strong>Enviado:</strong> {formatDate(row.submittedAt)} · <strong>Revisado:</strong> {formatDate(row.reviewedAt)} ·{" "}
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
              <button type="button" className="cta ghost small" onClick={() => void runAction(row.id, "set_pending")}>
                Pendiente
              </button>
              <button type="button" className="cta ghost small" onClick={() => void runAction(row.id, "request_correction")}>
                Rechazar
              </button>
              <button type="button" className="cta small" onClick={() => void runAction(row.id, "approve")}>
                Aprobar
              </button>
              <button type="button" className="cta small" onClick={() => void runAction(row.id, "activate")}>
                Activar
              </button>
            </div>
          </article>
        ))}
      </div>
    </AdminHeroShell>
  );
}
