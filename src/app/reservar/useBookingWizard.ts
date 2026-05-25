"use client";

import { useReducer } from "react";
import type { MatchProfessional, Service, Slot } from "./types";

export type WizardStep = "service" | "schedule" | "payment" | "success";

export type WizardAddress = {
  street: string;
  commune: string;
  city: string;
  postalCode: string;
  region?: string;
};

export type WizardState = {
  step: WizardStep;
  service: Service | null;
  pro: MatchProfessional | null;
  slot: Slot | null;
  startsAt: string;
  hours: number;
  address: WizardAddress;
  extras: { materials: boolean; urgency: boolean; travelFeeClp: number };
  details: string;
  payerEmail: string;
  holdExpiresAt: string | null;
  bookingId: string | null;
  error: string | null;
};

export type WizardAction =
  | { type: "SET_SERVICE"; service: Service | null }
  | { type: "SET_PRO"; pro: MatchProfessional | null }
  | { type: "SET_SLOT"; slot: Slot | null }
  | { type: "SET_STARTS_AT"; startsAt: string }
  | { type: "SET_HOURS"; hours: number }
  | { type: "SET_ADDRESS"; address: Partial<WizardAddress> }
  | { type: "SET_EXTRAS"; extras: Partial<WizardState["extras"]> }
  | { type: "SET_DETAILS"; details: string }
  | { type: "SET_PAYER_EMAIL"; payerEmail: string }
  | { type: "SET_HOLD"; holdExpiresAt: string | null }
  | { type: "SET_BOOKING_ID"; bookingId: string | null }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "GO_TO_STEP"; step: WizardStep }
  | { type: "RESET" };

export const initialBookingWizardState: WizardState = {
  step: "service",
  service: null,
  pro: null,
  slot: null,
  startsAt: "",
  hours: 1,
  address: { street: "", commune: "", city: "Santiago", postalCode: "", region: "Metropolitana" },
  extras: { materials: false, urgency: false, travelFeeClp: 0 },
  details: "",
  payerEmail: "",
  holdExpiresAt: null,
  bookingId: null,
  error: null
};

function reducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "SET_SERVICE":
      return { ...state, service: action.service };
    case "SET_PRO":
      return { ...state, pro: action.pro };
    case "SET_SLOT":
      return { ...state, slot: action.slot };
    case "SET_STARTS_AT":
      return { ...state, startsAt: action.startsAt };
    case "SET_HOURS":
      return { ...state, hours: Math.max(1, Math.min(8, action.hours)) };
    case "SET_ADDRESS":
      return { ...state, address: { ...state.address, ...action.address } };
    case "SET_EXTRAS":
      return { ...state, extras: { ...state.extras, ...action.extras } };
    case "SET_DETAILS":
      return { ...state, details: action.details };
    case "SET_PAYER_EMAIL":
      return { ...state, payerEmail: action.payerEmail };
    case "SET_HOLD":
      return { ...state, holdExpiresAt: action.holdExpiresAt };
    case "SET_BOOKING_ID":
      return { ...state, bookingId: action.bookingId };
    case "SET_ERROR":
      return { ...state, error: action.error };
    case "GO_TO_STEP":
      return { ...state, step: action.step, error: null };
    case "RESET":
      return initialBookingWizardState;
    default:
      return state;
  }
}

export function useBookingWizard(initialState: Partial<WizardState> = {}) {
  return useReducer(reducer, { ...initialBookingWizardState, ...initialState });
}

/**
 * Helper: holdea el slot remoto y persiste el holdExpiresAt en el state.
 * Devuelve true si el hold se tomó, false si está ocupado por otro.
 */
export async function holdSlotRemote(dispatch: React.Dispatch<WizardAction>, slotId: string) {
  try {
    const response = await fetch("/api/bookings/slot-hold", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slotId })
    });
    const data = (await response.json()) as { holdExpiresAt?: string; error?: string };
    if (!response.ok) {
      dispatch({ type: "SET_ERROR", error: data.error ?? "El horario está ocupado" });
      return false;
    }
    dispatch({ type: "SET_HOLD", holdExpiresAt: data.holdExpiresAt ?? null });
    return true;
  } catch (err) {
    dispatch({ type: "SET_ERROR", error: err instanceof Error ? err.message : "Error de red" });
    return false;
  }
}

export async function releaseSlotRemote(slotId: string) {
  try {
    await fetch(`/api/bookings/slot-hold?slotId=${encodeURIComponent(slotId)}`, { method: "DELETE" });
  } catch {
    // best effort, el cron de reconcile-payments libera holds expirados
  }
}
