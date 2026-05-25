"use client";

import type { MatchProfessional, Service, Slot } from "../types";

type Props = {
  service: Service | null;
  pro: MatchProfessional | null;
  slot: Slot | null;
  hours: number;
  extras: { materials: boolean; urgency: boolean; travelFeeClp: number };
  /** opcional: precio ya calculado server-side; si no, lo aproximamos */
  totalClp?: number | null;
  /** override de hourlyRateClp si el pro tiene tarifa específica */
  hourlyRateClp?: number | null;
};

function clp(value: number) {
  return `$${value.toLocaleString("es-CL")}`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-CL", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function BookingSummary({ service, pro, slot, hours, extras, totalClp, hourlyRateClp }: Props) {
  const rate = hourlyRateClp ?? pro?.hourlyRateFromClp ?? service?.basePriceClp ?? 0;
  const subtotal = rate * hours;
  const extrasSum = (extras.materials ? 5000 : 0) + (extras.urgency ? 3000 : 0) + (extras.travelFeeClp ?? 0);
  const platformFee = Math.round(subtotal * 0.12); // heurística visual, server recalcula
  const fallbackTotal = subtotal + extrasSum + platformFee;
  const total = typeof totalClp === "number" && totalClp > 0 ? totalClp : fallbackTotal;

  return (
    <aside
      className="auth-flow-panel"
      style={{
        position: "sticky",
        top: 20,
        padding: 24,
        borderRadius: 24,
        background: "#ffffff",
        border: "1px solid rgba(34,97,160,0.18)",
        boxShadow: "0 12px 32px rgba(21,58,97,0.08)",
        display: "grid",
        gap: 14
      }}
      aria-label="Resumen de la reserva"
    >
      <header>
        <p className="auth-flow-kicker" style={{ marginBottom: 4 }}>Tu reserva</p>
        <h3 style={{ margin: 0, fontSize: 20, color: "#17324d" }}>{service?.name ?? "Selecciona un servicio"}</h3>
      </header>

      <div style={{ display: "grid", gap: 6, fontSize: 14, color: "#48627d" }}>
        <p style={{ margin: 0 }}>
          <strong>Profesional:</strong> {pro?.fullName ?? "—"}
        </p>
        <p style={{ margin: 0 }}>
          <strong>Horario:</strong> {formatDateTime(slot?.startsAt)}
        </p>
        <p style={{ margin: 0 }}>
          <strong>Duración:</strong> {hours} hora(s)
        </p>
      </div>

      <div style={{ borderTop: "1px dashed #cdddee", paddingTop: 12, display: "grid", gap: 6, fontSize: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Subtotal ({hours}h × {clp(rate)})</span>
          <span>{clp(subtotal)}</span>
        </div>
        {extras.materials ? (
          <div style={{ display: "flex", justifyContent: "space-between", color: "#48627d" }}>
            <span>Materiales</span>
            <span>{clp(5000)}</span>
          </div>
        ) : null}
        {extras.urgency ? (
          <div style={{ display: "flex", justifyContent: "space-between", color: "#48627d" }}>
            <span>Urgencia</span>
            <span>{clp(3000)}</span>
          </div>
        ) : null}
        {extras.travelFeeClp > 0 ? (
          <div style={{ display: "flex", justifyContent: "space-between", color: "#48627d" }}>
            <span>Movilización</span>
            <span>{clp(extras.travelFeeClp)}</span>
          </div>
        ) : null}
        <div style={{ display: "flex", justifyContent: "space-between", color: "#48627d" }}>
          <span>Comisión WeTask</span>
          <span>{clp(platformFee)}</span>
        </div>
      </div>

      <div
        style={{
          borderTop: "1px solid #cdddee",
          paddingTop: 14,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline"
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 16, color: "#17324d" }}>Total</span>
        <span style={{ fontWeight: 900, fontSize: 22, color: "#173e73" }}>{clp(total)}</span>
      </div>

      <p style={{ margin: 0, fontSize: 12, color: "#5f7691" }}>
        El monto final se confirma al pagar. WeTask retiene el dinero en MercadoPago hasta que confirmes el servicio.
      </p>
    </aside>
  );
}
