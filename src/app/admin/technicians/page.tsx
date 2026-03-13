"use client";

import { useEffect, useState } from "react";
import { MarketNav } from "@/components/market-nav";

type TechnicianRow = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  commune: string;
  specialties: unknown;
  score: number;
  verificationStatus: "PENDING" | "UNDER_REVIEW" | "APPROVED" | "REJECTED";
  createdAt: string;
  reviewNotes: string | null;
};

function prettyStatus(status: TechnicianRow["verificationStatus"]) {
  if (status === "PENDING") return "pending";
  if (status === "UNDER_REVIEW") return "under_review";
  if (status === "APPROVED") return "approved";
  return "rejected";
}

export default function AdminTechniciansPage() {
  const [rows, setRows] = useState<TechnicianRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [okMessage, setOkMessage] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/technicians");
      const data = (await response.json()) as { technicians?: TechnicianRow[]; error?: string };
      if (!response.ok || !data.technicians) throw new Error(data.error || "No se pudo cargar listado");
      setRows(data.technicians);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const changeStatus = async (technicianId: string, action: "approve" | "reject" | "request_info") => {
    setError("");
    setOkMessage("");
    try {
      const response = await fetch("/api/admin/technicians", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ technicianId, action })
      });
      const data = (await response.json()) as { ok?: boolean; error?: string; detail?: string };
      if (!response.ok || !data.ok) throw new Error(data.detail || data.error || "No se pudo actualizar");
      setOkMessage("Estado actualizado correctamente");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    }
  };

  return (
    <main className="page market-shell">
      <MarketNav />
      <section className="panel">
        <div className="panel-head">
          <h2>Revision de tecnicos</h2>
          <p>Panel interno para aprobar, rechazar o solicitar mas informacion.</p>
        </div>

        {loading ? <p className="empty">Cargando tecnicos...</p> : null}
        {error ? <p className="feedback error">{error}</p> : null}
        {okMessage ? <p className="feedback ok">{okMessage}</p> : null}

        <div className="list">
          {rows.map((row) => (
            <article key={row.id} className="booking-card">
              <div className="booking-head">
                <h3>{row.fullName}</h3>
                <span className={`status status-${prettyStatus(row.verificationStatus)}`}>{prettyStatus(row.verificationStatus)}</span>
              </div>
              <p>
                <strong>Comuna:</strong> {row.commune} · <strong>Score:</strong> {row.score}/100
              </p>
              <p>
                <strong>Email:</strong> {row.email} · <strong>Telefono:</strong> {row.phone}
              </p>
              <p>
                <strong>Especialidad:</strong> {Array.isArray(row.specialties) ? row.specialties.join(", ") : "-"}
              </p>
              {row.reviewNotes ? (
                <p>
                  <strong>Notas:</strong> {row.reviewNotes}
                </p>
              ) : null}
              <div className="cta-row">
                <button type="button" className="cta small" onClick={() => void changeStatus(row.id, "approve")}>
                  Aprobar
                </button>
                <button type="button" className="cta ghost small" onClick={() => void changeStatus(row.id, "request_info")}>
                  Solicitar mas informacion
                </button>
                <button type="button" className="cta ghost small" onClick={() => void changeStatus(row.id, "reject")}>
                  Rechazar
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
