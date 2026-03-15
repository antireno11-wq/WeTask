"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MarketNav } from "@/components/market-nav";

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
    <main className="page market-shell">
      <MarketNav />

      <section className="panel admin-page-shell">
        <div className="panel-head admin-page-head">
          <div>
            <span className="eyebrow">Revisión manual</span>
            <h2>Validación de profesionales</h2>
            <p>Flujo interno para revisar documentos, pedir correcciones, aprobar y activar taskers.</p>
          </div>
          <Link href="/admin/team" className="cta ghost small">
            Ver equipo interno
          </Link>
        </div>

        <div className="cta-row">
          <Link href="/admin/technicians" className="cta ghost small">
            Ver tecnicos legacy
          </Link>
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
                  Pedir correccion
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
      </section>
    </main>
  );
}
