"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ReviewActionProps = {
  onboardingId: string;
  status: "BORRADOR" | "PENDIENTE_REVISION" | "REQUIERE_CORRECCION" | "APROBADO" | "ACTIVO";
};

export function AdminCleaningReviewActions({ onboardingId, status }: ReviewActionProps) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [loadingAction, setLoadingAction] = useState<"approve" | "request_correction" | "activate" | null>(null);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");

  const runAction = async (action: "approve" | "request_correction" | "activate") => {
    if (action === "request_correction" && !notes.trim()) {
      setError("Debes escribir la causa del rechazo antes de continuar.");
      setFeedback("");
      return;
    }

    setLoadingAction(action);
    setError("");
    setFeedback("");

    try {
      const response = await fetch("/api/admin/onboarding/cleaning", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          onboardingId,
          action,
          notes: notes.trim() || undefined
        })
      });

      const data = (await response.json()) as { ok?: boolean; error?: string; detail?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.detail || data.error || "No se pudo completar la acción.");
      }

      setFeedback(
        action === "approve"
          ? "La revisión fue aprobada correctamente."
          : action === "request_correction"
            ? "Se rechazó la revisión y se envió el motivo por correo."
            : "El perfil fue activado correctamente."
      );
      if (action === "request_correction") {
        setNotes("");
      }
      router.refresh();
    } catch (eventualError) {
      setError(eventualError instanceof Error ? eventualError.message : "No se pudo completar la acción.");
    } finally {
      setLoadingAction(null);
    }
  };

  const canActivate = status === "APROBADO";

  return (
    <section className="admin-section-card">
      <div className="admin-section-head">
        <div>
          <h3>Decisión de revisión</h3>
          <p>Aquí puedes aprobar la validación interna o rechazarla dejando la causa para el profesional.</p>
        </div>
      </div>

      <div className="admin-note-block">
        <strong>Motivo de rechazo o notas internas</strong>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Ej: falta una foto legible del carnet o el certificado de antecedentes está vencido."
          rows={5}
          style={{
            width: "100%",
            marginTop: "12px",
            borderRadius: "18px",
            border: "1px solid #cdddee",
            padding: "14px 16px",
            font: "inherit",
            resize: "vertical",
            minHeight: "132px"
          }}
        />
      </div>

      <div className="cta-row">
        <button type="button" className="cta small" onClick={() => void runAction("approve")} disabled={loadingAction !== null}>
          {loadingAction === "approve" ? "Aprobando..." : "Aprobar revisión"}
        </button>
        <button type="button" className="cta ghost small" onClick={() => void runAction("request_correction")} disabled={loadingAction !== null}>
          {loadingAction === "request_correction" ? "Enviando..." : "Rechazar revisión"}
        </button>
        {canActivate ? (
          <button type="button" className="cta small" onClick={() => void runAction("activate")} disabled={loadingAction !== null}>
            {loadingAction === "activate" ? "Activando..." : "Activar perfil"}
          </button>
        ) : null}
      </div>

      {feedback ? <p className="feedback ok">{feedback}</p> : null}
      {error ? <p className="feedback error">{error}</p> : null}
    </section>
  );
}
