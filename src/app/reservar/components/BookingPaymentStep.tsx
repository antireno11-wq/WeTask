"use client";

import { useEffect, useState } from "react";
import { MercadoPagoBrick } from "@/components/mercadopago-brick";
import { fireConfetti } from "@/lib/confetti";
import type { MatchProfessional, Service, Slot } from "../types";
import { releaseSlotRemote, type WizardState } from "../useBookingWizard";

type Props = {
  customerId: string;
  state: WizardState;
  service: Service;
  pro: MatchProfessional;
  slot: Slot;
  amountClp: number;
  onPaid: (bookingId: string) => void;
  onBack: () => void;
};

type BrickPayload = {
  token: string;
  payment_method_id?: string;
  issuer_id?: string | number;
  installments?: number;
  payer?: {
    email?: string;
    identification?: { type?: string; number?: string };
  };
};

export function BookingPaymentStep({ customerId, state, service, pro, slot, amountClp, onPaid, onBack }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [holdSecondsLeft, setHoldSecondsLeft] = useState<number>(0);

  // Countdown del hold
  useEffect(() => {
    if (!state.holdExpiresAt) return;
    const tick = () => {
      const remainingMs = new Date(state.holdExpiresAt!).getTime() - Date.now();
      setHoldSecondsLeft(Math.max(0, Math.floor(remainingMs / 1000)));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [state.holdExpiresAt]);

  // Si abandonan el step sin pagar, liberar hold (best-effort)
  useEffect(() => {
    return () => {
      if (slot.id) void releaseSlotRemote(slot.id);
    };
  }, [slot.id]);

  const handleCardTokenized = async (payload: BrickPayload) => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/bookings/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          serviceId: service.id,
          proId: pro.userId,
          slotId: slot.id,
          startsAt: state.startsAt,
          hours: state.hours,
          address: state.address,
          details: state.details || undefined,
          extras: state.extras,
          payment: {
            token: payload.token,
            paymentMethodId: payload.payment_method_id,
            issuerId: payload.issuer_id ? String(payload.issuer_id) : undefined,
            installments: payload.installments ?? 1,
            payerEmail: payload.payer?.email ?? state.payerEmail,
            payerIdentificationType: payload.payer?.identification?.type,
            payerIdentificationNumber: payload.payer?.identification?.number
          }
        })
      });

      const data = (await response.json()) as {
        booking?: { id: string; status: string; paymentStatus: string };
        error?: string;
        detail?: string;
        reason?: string;
      };

      if (!response.ok || !data.booking) {
        throw new Error(data.detail || data.error || `Checkout falló (${response.status})`);
      }

      if (data.booking.paymentStatus === "PAID" || data.booking.status === "CONFIRMED") {
        fireConfetti();
        onPaid(data.booking.id);
      } else if (data.booking.paymentStatus === "PENDING") {
        setError("Tu pago quedó en revisión. Te avisaremos por correo cuando esté aprobado.");
        onPaid(data.booking.id);
      } else {
        setError("El pago no pudo procesarse. Intenta con otra tarjeta.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error procesando el pago");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="auth-flow-panel client-dashboard-section">
      <div className="panel-head auth-flow-panel-head">
        <h2>Confirma tu reserva</h2>
        <p>El pago se procesa con MercadoPago. Tu dinero queda retenido hasta que confirmes el servicio.</p>
      </div>

      {state.holdExpiresAt && holdSecondsLeft > 0 ? (
        <p style={{ margin: "0 0 16px", color: "#48627d", fontSize: 14 }}>
          ⏱ Tenemos reservado tu horario por{" "}
          <strong>
            {Math.floor(holdSecondsLeft / 60)}:{String(holdSecondsLeft % 60).padStart(2, "0")}
          </strong>{" "}
          minutos.
        </p>
      ) : state.holdExpiresAt ? (
        <p className="feedback error">
          ⏱ El tiempo de reserva del horario expiró. Vuelve atrás y elige el horario de nuevo.
        </p>
      ) : null}

      <MercadoPagoBrick
        amountClp={amountClp}
        payerEmail={state.payerEmail}
        onCardTokenized={(payload) => void handleCardTokenized(payload)}
        onError={(err) => {
          if (err instanceof Error) setError(err.message);
        }}
      />

      {error ? <p className="feedback error" style={{ marginTop: 12 }}>{error}</p> : null}
      {submitting ? <p className="empty" style={{ marginTop: 12 }}>Procesando pago...</p> : null}

      <div className="cta-row" style={{ marginTop: 16 }}>
        <button type="button" className="cta ghost" onClick={onBack} disabled={submitting}>
          Volver
        </button>
      </div>
    </section>
  );
}
