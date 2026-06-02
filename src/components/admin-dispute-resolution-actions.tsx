"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type DisputeStatus = "OPEN" | "IN_REVIEW" | "RESOLVED" | "CLOSED";

type Props = {
  disputeId: string;
  currentStatus: DisputeStatus;
  paymentAmountClp: number | null;
  alreadyRefundedAmountClp: number | null;
  canRefund: boolean;
};

export function AdminDisputeResolutionActions({
  disputeId,
  currentStatus,
  paymentAmountClp,
  alreadyRefundedAmountClp,
  canRefund
}: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<DisputeStatus>(
    currentStatus === "RESOLVED" || currentStatus === "CLOSED" ? "IN_REVIEW" : currentStatus
  );
  const [resolution, setResolution] = useState("");
  const [refundAmount, setRefundAmount] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [confirming, setConfirming] = useState(false);

  const refundAmountNumber = Number(refundAmount.replace(/\D/g, "")) || 0;
  const refundWillHappen = status === "RESOLVED" && refundAmountNumber > 0;

  const submit = async () => {
    setLoading(true);
    setError("");
    setFeedback("");
    try {
      const response = await fetch("/api/marketplace/admin/disputes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          disputeId,
          status,
          resolution: resolution.trim() || undefined,
          refundAmountClp: refundWillHappen ? refundAmountNumber : undefined
        })
      });
      const data = (await response.json()) as { dispute?: unknown; error?: string; detail?: string; providerRefunded?: boolean };
      if (!response.ok) {
        throw new Error(data.detail || data.error || "No se pudo resolver la disputa");
      }
      setFeedback(
        refundWillHappen
          ? `Disputa resuelta. Se devolvieron $${refundAmountNumber.toLocaleString("es-CL")} al cliente.`
          : "Disputa actualizada correctamente."
      );
      setConfirming(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="admin-section-card">
      <div className="admin-section-head">
        <div>
          <h3>Resolver disputa</h3>
          <p>Actualiza el estado del reclamo. Si pides reembolso, se llama a MercadoPago en serio.</p>
        </div>
      </div>

      <div className="admin-kv-grid">
        <label>
          <strong>Nuevo estado</strong>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as DisputeStatus)}
            disabled={loading}
            style={{ marginTop: 8, padding: "10px 12px", borderRadius: 12, border: "1px solid #cdddee", font: "inherit", width: "100%" }}
          >
            <option value="OPEN">Abierta</option>
            <option value="IN_REVIEW">En revisión</option>
            <option value="RESOLVED">Resuelta</option>
            <option value="CLOSED">Cerrada (sin acción)</option>
          </select>
        </label>

        <label>
          <strong>Monto a reembolsar (CLP)</strong>
          <input
            type="text"
            inputMode="numeric"
            value={refundAmount}
            onChange={(event) => setRefundAmount(event.target.value)}
            disabled={loading || status !== "RESOLVED" || !canRefund}
            placeholder={canRefund ? "Ej: 12000 (0 = sin reembolso)" : "No disponible (sin providerPaymentId MP)"}
            style={{ marginTop: 8, padding: "10px 12px", borderRadius: 12, border: "1px solid #cdddee", font: "inherit", width: "100%" }}
          />
          {paymentAmountClp !== null ? (
            <span className="input-hint">
              Cobrado: ${paymentAmountClp.toLocaleString("es-CL")}
              {alreadyRefundedAmountClp ? ` · ya reembolsado: $${alreadyRefundedAmountClp.toLocaleString("es-CL")}` : ""}
            </span>
          ) : null}
        </label>
      </div>

      <div className="admin-note-block" style={{ marginTop: 16 }}>
        <strong>Resolución / mensaje al cliente y tasker</strong>
        <textarea
          value={resolution}
          onChange={(event) => setResolution(event.target.value)}
          disabled={loading}
          placeholder="Describe brevemente la decisión que se les comunicará por email."
          rows={4}
          style={{
            width: "100%",
            marginTop: 12,
            borderRadius: 18,
            border: "1px solid #cdddee",
            padding: "14px 16px",
            font: "inherit",
            resize: "vertical",
            minHeight: 110
          }}
        />
      </div>

      {confirming && refundWillHappen ? (
        <div
          style={{
            margin: "16px 0",
            padding: "14px 16px",
            borderRadius: 14,
            border: "2px solid #b00020",
            background: "#ffe9ec"
          }}
        >
          <p style={{ margin: 0 }}>
            <strong>Estás por reembolsar ${refundAmountNumber.toLocaleString("es-CL")} CLP al cliente.</strong>
          </p>
          <p style={{ margin: "6px 0 0", fontSize: 14, color: "#48627d" }}>
            Esto llama a MercadoPago en tiempo real. Si la respuesta falla, no se altera la DB. ¿Confirmas?
          </p>
        </div>
      ) : null}

      <div className="cta-row">
        {refundWillHappen && !confirming ? (
          <button type="button" className="cta" disabled={loading} onClick={() => setConfirming(true)}>
            Revisar reembolso
          </button>
        ) : (
          <button type="button" className="cta" disabled={loading} onClick={() => void submit()}>
            {loading ? "Procesando..." : refundWillHappen ? "Confirmar y reembolsar" : "Guardar cambios"}
          </button>
        )}
        {confirming ? (
          <button type="button" className="cta ghost" disabled={loading} onClick={() => setConfirming(false)}>
            Cancelar
          </button>
        ) : null}
      </div>

      {feedback ? <p className="feedback ok">{feedback}</p> : null}
      {error ? <p className="feedback error">{error}</p> : null}
    </section>
  );
}
