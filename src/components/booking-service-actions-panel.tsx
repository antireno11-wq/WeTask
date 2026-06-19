"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type BookingStatus =
  | "PENDING_PAYMENT"
  | "PAYMENT_FAILED"
  | "CONFIRMED"
  | "ASSIGNED"
  | "ACCEPTED"
  | "IN_PROGRESS"
  | "AWAITING_CUSTOMER_CONFIRMATION"
  | "PAYOUT_SCHEDULED"
  | "COMPLETED"
  | "CANCELLED"
  | "DISPUTE"
  | "REFUNDED";

type Props = {
  bookingId: string;
  status: BookingStatus;
  paymentStatus: string;
  onTheWayAt: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
};

type AsyncStage = "idle" | "loading" | "ok" | "error";

const ON_THE_WAY_STATES = new Set<BookingStatus>(["CONFIRMED", "ACCEPTED", "IN_PROGRESS"]);
const CHECK_IN_STATES = new Set<BookingStatus>(["CONFIRMED", "ACCEPTED", "IN_PROGRESS"]);
const CHECK_OUT_STATES = new Set<BookingStatus>(["IN_PROGRESS", "ACCEPTED", "CONFIRMED"]);

function formatTime(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("es-CL", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

async function getCurrentPosition(): Promise<GeolocationPosition | null> {
  if (typeof window === "undefined" || !navigator.geolocation) return null;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 }
    );
  });
}

async function uploadCheckInPhoto(file: File): Promise<string | null> {
  const presignResponse = await fetch("/api/uploads/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      kind: "check_in_photo",
      contentType: file.type || "image/jpeg",
      sizeBytes: file.size
    })
  });
  if (presignResponse.status === 503) return null; // R2 no configurado, sin foto
  if (!presignResponse.ok) {
    const data = (await presignResponse.json().catch(() => ({}))) as { error?: string };
    throw new Error(data?.error || `presign falló (${presignResponse.status})`);
  }
  const { uploadUrl, key } = (await presignResponse.json()) as { uploadUrl: string; key: string };
  const putResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type || "image/jpeg" },
    body: file
  });
  if (!putResponse.ok) throw new Error("La foto no se pudo subir");
  return key;
}

export function BookingServiceActionsPanel({
  bookingId,
  status,
  paymentStatus,
  onTheWayAt,
  checkInAt,
  checkOutAt
}: Props) {
  const router = useRouter();
  const [otwState, setOtwState] = useState<AsyncStage>("idle");
  const [checkInState, setCheckInState] = useState<AsyncStage>("idle");
  const [checkOutState, setCheckOutState] = useState<AsyncStage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const paymentReady = paymentStatus === "PAID";
  const canOnTheWay = paymentReady && ON_THE_WAY_STATES.has(status);
  const canCheckIn = paymentReady && CHECK_IN_STATES.has(status) && !checkInAt;
  const canCheckOut = paymentReady && CHECK_OUT_STATES.has(status) && !checkOutAt;

  const callOnTheWay = async () => {
    setError(null);
    setInfo(null);
    setOtwState("loading");
    try {
      const response = await fetch(`/api/marketplace/bookings/${bookingId}/on-the-way`, { method: "POST" });
      const data = (await response.json()) as { ok?: boolean; deduped?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "No se pudo notificar");
      setOtwState("ok");
      setInfo(data.deduped ? "Ya habías avisado hace un rato." : "Avisamos al cliente que vas en camino.");
      router.refresh();
    } catch (e) {
      setOtwState("error");
      setError(e instanceof Error ? e.message : "Error inesperado");
    }
  };

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setPhotoFile(null);
      setPhotoPreview(null);
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const callCheckIn = async () => {
    setError(null);
    setInfo(null);
    setCheckInState("loading");
    try {
      let photoKey: string | null = null;
      if (photoFile) {
        try {
          photoKey = await uploadCheckInPhoto(photoFile);
        } catch (uploadErr) {
          setError(uploadErr instanceof Error ? uploadErr.message : "Error subiendo foto");
          setCheckInState("error");
          return;
        }
      }
      const position = await getCurrentPosition();
      const payload: Record<string, unknown> = {};
      if (position) {
        payload.lat = position.coords.latitude;
        payload.lng = position.coords.longitude;
      }
      if (photoKey) payload.photoKey = photoKey;

      const response = await fetch(`/api/marketplace/bookings/${bookingId}/check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "No se pudo registrar llegada");
      setCheckInState("ok");
      setInfo("Llegada registrada. Avisamos al cliente.");
      setPhotoFile(null);
      setPhotoPreview(null);
      router.refresh();
    } catch (e) {
      setCheckInState("error");
      setError(e instanceof Error ? e.message : "Error inesperado");
    }
  };

  const callCheckOut = async () => {
    setError(null);
    setInfo(null);
    if (!window.confirm("¿Servicio terminado? El cliente recibirá un aviso para confirmar y calificar.")) return;
    setCheckOutState("loading");
    try {
      const response = await fetch(`/api/marketplace/bookings/${bookingId}/check-out`, { method: "POST" });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "No se pudo cerrar el servicio");
      setCheckOutState("ok");
      setInfo("Servicio cerrado. El cliente fue notificado para confirmar.");
      router.refresh();
    } catch (e) {
      setCheckOutState("error");
      setError(e instanceof Error ? e.message : "Error inesperado");
    }
  };

  return (
    <section
      className="admin-section-card"
      style={{ display: "grid", gap: 18, marginTop: 16 }}
    >
      <div className="admin-section-head">
        <div>
          <h3>Ceremonia del servicio</h3>
          <p>Llevá al cliente paso a paso: avisás cuando salís, marcás llegada y cerrás cuando terminás.</p>
        </div>
      </div>

      {!paymentReady ? (
        <p className="feedback error">El pago aún no está confirmado. No puedes iniciar la ceremonia.</p>
      ) : null}

      <ol style={{ display: "grid", gap: 14, margin: 0, padding: 0, listStyle: "none" }}>
        {/* Paso 1 — Voy en camino */}
        <li
          style={{
            padding: 16,
            borderRadius: 16,
            border: "1px solid rgba(34,97,160,0.18)",
            background: onTheWayAt ? "#eafff3" : "#ffffff"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div>
              <strong style={{ display: "block", color: "#17324d" }}>1 · Voy en camino</strong>
              <span style={{ fontSize: 13, color: "#48627d" }}>
                {onTheWayAt ? `Avisaste a las ${formatTime(onTheWayAt)}` : "Le mandamos un push al cliente."}
              </span>
            </div>
            <button
              type="button"
              className={`cta ${onTheWayAt ? "ghost" : ""}`}
              onClick={() => void callOnTheWay()}
              disabled={!canOnTheWay || otwState === "loading"}
            >
              {otwState === "loading" ? "Avisando..." : onTheWayAt ? "Volver a avisar" : "Avisar al cliente"}
            </button>
          </div>
        </li>

        {/* Paso 2 — Llegué */}
        <li
          style={{
            padding: 16,
            borderRadius: 16,
            border: "1px solid rgba(34,97,160,0.18)",
            background: checkInAt ? "#eafff3" : "#ffffff"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div>
              <strong style={{ display: "block", color: "#17324d" }}>2 · Marcar llegada</strong>
              <span style={{ fontSize: 13, color: "#48627d" }}>
                {checkInAt
                  ? `Llegaste a las ${formatTime(checkInAt)}`
                  : "Capturamos tu ubicación y, si quieres, una foto del antes."}
              </span>
            </div>
            <button
              type="button"
              className="cta"
              onClick={() => void callCheckIn()}
              disabled={!canCheckIn || checkInState === "loading"}
            >
              {checkInState === "loading" ? "Registrando..." : "Llegué"}
            </button>
          </div>
          {canCheckIn ? (
            <label style={{ display: "block", marginTop: 12, fontSize: 13, color: "#48627d" }}>
              Foto opcional (antes)
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePhotoChange}
                style={{ display: "block", marginTop: 6 }}
              />
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="Vista previa"
                  style={{ display: "block", marginTop: 8, maxWidth: 180, borderRadius: 12 }}
                />
              ) : null}
            </label>
          ) : null}
        </li>

        {/* Paso 3 — Cierre */}
        <li
          style={{
            padding: 16,
            borderRadius: 16,
            border: "1px solid rgba(34,97,160,0.18)",
            background: checkOutAt ? "#eafff3" : "#ffffff"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div>
              <strong style={{ display: "block", color: "#17324d" }}>3 · Servicio completado</strong>
              <span style={{ fontSize: 13, color: "#48627d" }}>
                {checkOutAt
                  ? `Cerraste el servicio a las ${formatTime(checkOutAt)}`
                  : "Marcamos la reserva como esperando confirmación del cliente."}
              </span>
            </div>
            <button
              type="button"
              className="cta"
              onClick={() => void callCheckOut()}
              disabled={!canCheckOut || checkOutState === "loading"}
            >
              {checkOutState === "loading" ? "Cerrando..." : "Terminé el servicio"}
            </button>
          </div>
        </li>
      </ol>

      {info ? <p className="feedback ok">{info}</p> : null}
      {error ? <p className="feedback error">{error}</p> : null}
    </section>
  );
}
