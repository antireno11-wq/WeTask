"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SaveState = "idle" | "saving" | "saved" | "error";

type AutosaveOptions = {
  /** Endpoint relativo donde hacer PATCH (default /api/onboarding/cleaning/me). */
  endpoint?: string;
  /** Debounce ms antes de disparar el PATCH (default 1500). */
  debounceMs?: number;
  /** Si false, deshabilita el autosave (útil en modo lectura). */
  enabled?: boolean;
};

/**
 * Hook de autosave debounced para el wizard de onboarding.
 *
 * Uso:
 *   const { saveState, lastSavedAt, scheduleSave, flushSave } =
 *     useOnboardingAutosave({ enabled: session.role === "PRO" });
 *
 *   // En cada cambio relevante:
 *   scheduleSave({ baseCommune: nextValue });
 *
 *   // Al cambiar de step manualmente:
 *   await flushSave();
 *
 * No mantiene el "draft" — es responsabilidad del caller mantener el state
 * y armar el payload a serializar. El hook solo controla la cadencia y el
 * estado visual del indicador.
 */
export function useOnboardingAutosave(options: AutosaveOptions = {}) {
  const endpoint = options.endpoint ?? "/api/onboarding/cleaning/me";
  const debounceMs = options.debounceMs ?? 1500;
  const enabled = options.enabled !== false;

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPayloadRef = useRef<Record<string, unknown> | null>(null);
  const inFlightRef = useRef(false);

  const persist = useCallback(async () => {
    if (!enabled) return;
    const payload = pendingPayloadRef.current;
    if (!payload || inFlightRef.current) return;
    inFlightRef.current = true;
    pendingPayloadRef.current = null;
    setSaveState("saving");
    try {
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string; detail?: string };
        throw new Error(data.detail || data.error || `Autosave falló (${response.status})`);
      }
      setSaveState("saved");
      setLastSavedAt(new Date());
    } catch (err) {
      console.warn("[onboarding-autosave]", err);
      setSaveState("error");
    } finally {
      inFlightRef.current = false;
      // Si se acumuló otro payload mientras corría, re-encolar.
      if (pendingPayloadRef.current) {
        scheduleSave({});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint, enabled]);

  const scheduleSave = useCallback(
    (patch: Record<string, unknown>) => {
      if (!enabled) return;
      // Merge superficial sobre el payload pendiente
      pendingPayloadRef.current = { ...(pendingPayloadRef.current ?? {}), ...patch };
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void persist();
      }, debounceMs);
    },
    [debounceMs, enabled, persist]
  );

  const flushSave = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    await persist();
  }, [persist]);

  // Cleanup al unmount: flush pendiente.
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      // Sin await en cleanup — es best effort.
      void persist();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { saveState, lastSavedAt, scheduleSave, flushSave };
}
