"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { MarketNav } from "@/components/market-nav";

type BookingDetail = {
  id: string;
  service: { name: string };
  pro: { fullName: string; email: string } | null;
  scheduledAt: string;
};

type EvidenceDraft = {
  name: string;
  type: string;
  size: number;
  dataUrl: string;
};

const REPORT_OPTIONS = [
  "El tasker no llegó",
  "El servicio quedó incompleto",
  "Hubo daños o un incidente",
  "El horario no se respetó",
  "Hubo un cobro o extra no acordado",
  "Otro problema"
];

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export default function ClienteBookingProblemPage() {
  const params = useParams<{ bookingId: string }>();
  const bookingId = params?.bookingId ?? "";

  const [customerId, setCustomerId] = useState("");
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [category, setCategory] = useState(REPORT_OPTIONS[0]);
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState<EvidenceDraft[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  const evidenceLabel = useMemo(() => {
    if (evidence.length === 0) return "Sin fotos adjuntas";
    return `${evidence.length} archivo(s) adjunto(s)`;
  }, [evidence.length]);

  useEffect(() => {
    const load = async () => {
      try {
        const sessionRes = await fetch("/api/auth/session");
        const sessionData = (await sessionRes.json()) as { session?: { userId: string } | null; error?: string; detail?: string };
        if (!sessionRes.ok || !sessionData.session?.userId) {
          throw new Error(sessionData.detail || sessionData.error || "No se pudo cargar sesión");
        }
        setCustomerId(sessionData.session.userId);

        const bookingRes = await fetch(`/api/marketplace/bookings/${bookingId}`);
        const bookingData = (await bookingRes.json()) as { booking?: BookingDetail; error?: string; detail?: string };
        if (!bookingRes.ok || !bookingData.booking) {
          throw new Error(bookingData.detail || bookingData.error || "No se pudo cargar la reserva");
        }
        setBooking(bookingData.booking);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error inesperado");
      }
    };
    if (bookingId) void load();
  }, [bookingId]);

  const handleEvidenceChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).slice(0, 3);
    if (files.length === 0) return;

    try {
      const loaded = await Promise.all(
        files.map(
          (file) =>
            new Promise<EvidenceDraft>((resolve, reject) => {
              if (file.size > 2_000_000) {
                reject(new Error(`"${file.name}" supera el máximo de 2 MB.`));
                return;
              }

              const reader = new FileReader();
              reader.onload = () => {
                const result = typeof reader.result === "string" ? reader.result : "";
                resolve({
                  name: file.name,
                  type: file.type || "image/jpeg",
                  size: file.size,
                  dataUrl: result
                });
              };
              reader.onerror = () => reject(new Error(`No pudimos leer "${file.name}".`));
              reader.readAsDataURL(file);
            })
        )
      );
      setEvidence(loaded);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos cargar las fotos.");
    }
  };

  const submitProblem = async (event: FormEvent) => {
    event.preventDefault();
    if (!bookingId || !customerId) return;
    if (reason.trim().length < 12) {
      setError("Cuéntanos un poco más sobre lo que pasó antes de enviar el reporte.");
      return;
    }

    setSubmitting(true);
    setError("");
    setFeedback("");
    try {
      const response = await fetch("/api/marketplace/disputes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId,
          openedById: customerId,
          category,
          reason: reason.trim(),
          evidence
        })
      });
      const data = (await response.json()) as { ticket?: { id: string }; error?: string; detail?: string };
      if (!response.ok || !data.ticket) {
        throw new Error(data.detail || data.error || "No se pudo enviar el reporte");
      }
      setFeedback("Recibimos tu reporte. Nuestro equipo revisará el caso a la brevedad.");
      setReason("");
      setEvidence([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-flow-screen auth-flow-screen-scroll market-shell-auth">
      <div className="auth-flow-backdrop" aria-hidden />

      <div className="login-screen-content market-shell-auth-content">
        <MarketNav />

        <section className="auth-flow-shell auth-flow-shell-wide client-dashboard-hero">
          <div className="auth-flow-copy client-dashboard-copy">
            <p className="auth-flow-kicker">Reportar un problema</p>
            <h1>{booking?.service.name ?? "Cuéntanos qué pasó"}</h1>
            <p>Explícanos lo ocurrido con claridad. Si tienes fotos, puedes adjuntarlas para que soporte revise mejor el caso.</p>
            <div className="auth-flow-actions">
              <Link className="cta ghost" href={`/cliente/reservas/${bookingId}`}>
                Volver al servicio
              </Link>
            </div>
          </div>

          <section className="auth-flow-panel auth-flow-panel-wide client-dashboard-profile-panel">
            <div className="panel-head client-dashboard-panel-head">
              <h2>Resumen de la reserva</h2>
              <p>Así sabremos exactamente sobre qué servicio estás reportando.</p>
            </div>
            {booking ? (
              <div className="client-booking-overview">
                <article className="module-card client-dashboard-metric">
                  <h3>Tasker</h3>
                  <p>{booking.pro?.fullName ?? "Pendiente"}</p>
                </article>
                <article className="module-card client-dashboard-metric">
                  <h3>Fecha</h3>
                  <p>{formatDateTime(booking.scheduledAt)}</p>
                </article>
                <article className="module-card client-dashboard-metric">
                  <h3>Adjuntos</h3>
                  <p>{evidenceLabel}</p>
                </article>
              </div>
            ) : (
              <p className="empty">Cargando reserva...</p>
            )}
          </section>
        </section>

        <div className="page client-dashboard-sections">
          {feedback ? <p className="feedback ok">{feedback}</p> : null}
          {error ? <p className="feedback error">{error}</p> : null}

          <section className="auth-flow-panel client-dashboard-section">
            <div className="panel-head client-dashboard-panel-head">
              <h2>Describe el problema</h2>
              <p>Selecciona el motivo y cuéntanos qué pasó. Si tienes fotos, puedes subirlas aquí mismo.</p>
            </div>

            <form className="grid-form support-form-grid" onSubmit={submitProblem}>
              <label className="full">
                Categoría
                <select value={category} onChange={(event) => setCategory(event.target.value)}>
                  {REPORT_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="full">
                Qué pasó
                <textarea
                  rows={6}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Ejemplo: el tasker llegó más tarde, faltaron tareas acordadas o hubo algún problema durante el servicio."
                />
              </label>
              <label className="full">
                Adjuntar fotos
                <input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={handleEvidenceChange} />
                <p className="input-hint">Opcional. Puedes subir hasta 3 fotos de máximo 2 MB cada una.</p>
              </label>

              {evidence.length > 0 ? (
                <div className="full support-evidence-grid">
                  {evidence.map((file) => (
                    <article key={file.name} className="support-evidence-card">
                      <strong>{file.name}</strong>
                      <span>{Math.round(file.size / 1024)} KB</span>
                    </article>
                  ))}
                </div>
              ) : null}

              <div className="full auth-flow-actions support-section-actions">
                <button className="cta" type="submit" disabled={submitting}>
                  {submitting ? "Enviando..." : "Enviar reporte"}
                </button>
                <Link className="cta ghost" href={`/cliente/reservas/${bookingId}`}>
                  Cancelar
                </Link>
              </div>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
