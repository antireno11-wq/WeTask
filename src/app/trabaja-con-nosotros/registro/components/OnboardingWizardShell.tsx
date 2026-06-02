"use client";

import type { ReactNode } from "react";

export type WizardStepMeta = {
  index: number;
  label: string;
  shortLabel?: string;
};

type Props = {
  steps: WizardStepMeta[];
  currentStepIndex: number;
  /** Estado del autosave: `idle` / `saving` / `saved` / `error`. */
  saveState?: "idle" | "saving" | "saved" | "error";
  lastSavedAt?: Date | null;
  onStepClick?: (index: number) => void;
  children: ReactNode;
};

/**
 * Shell reusable para el wizard de onboarding del tasker:
 * - Barra de progreso (numérica + porcentaje).
 * - Indicador de autosave en la esquina (silencioso si idle).
 * - Navegación clickeable solo hacia steps ya completados.
 *
 * Pensado para envolver cualquier step component sin asumir nada de su
 * forma interna. Diseñado para integrarse gradualmente con la mega-page
 * existente: empezar usándolo sólo en los steps nuevos.
 */
export function OnboardingWizardShell({
  steps,
  currentStepIndex,
  saveState = "idle",
  lastSavedAt,
  onStepClick,
  children
}: Props) {
  const totalSteps = steps.length;
  const progressPct = Math.min(100, Math.round((currentStepIndex / totalSteps) * 100));

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div
        style={{
          padding: "16px 20px",
          background: "#ffffff",
          borderRadius: 18,
          border: "1px solid rgba(34,97,160,0.18)",
          display: "grid",
          gap: 14
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <p className="auth-flow-kicker" style={{ margin: 0 }}>
              Paso {currentStepIndex} de {totalSteps}
            </p>
            <h2 style={{ margin: "2px 0 0", fontSize: 18, color: "#17324d" }}>
              {steps[currentStepIndex - 1]?.label ?? "Empezamos"}
            </h2>
          </div>
          <SaveIndicator state={saveState} lastSavedAt={lastSavedAt ?? null} />
        </div>

        <div
          aria-label="Progreso del registro"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressPct}
          style={{
            height: 8,
            borderRadius: 8,
            background: "#eef4fb",
            overflow: "hidden",
            position: "relative"
          }}
        >
          <div
            style={{
              width: `${progressPct}%`,
              height: "100%",
              background: "linear-gradient(135deg,#173e73 0%,#1d7fc6 70%,#76f2c0 100%)",
              transition: "width 240ms ease-out"
            }}
          />
        </div>

        <ol
          style={{
            display: "flex",
            gap: 6,
            margin: 0,
            padding: 0,
            listStyle: "none",
            flexWrap: "wrap"
          }}
        >
          {steps.map((step) => {
            const isActive = step.index === currentStepIndex;
            const isDone = step.index < currentStepIndex;
            const clickable = Boolean(onStepClick) && (isDone || isActive);
            return (
              <li key={step.index}>
                <button
                  type="button"
                  onClick={clickable ? () => onStepClick!(step.index) : undefined}
                  disabled={!clickable}
                  style={{
                    border: 0,
                    background: isActive ? "#18a6d5" : isDone ? "#76f2c0" : "#eef4fb",
                    color: isActive ? "#ffffff" : isDone ? "#0e4a30" : "#5f7691",
                    padding: "6px 12px",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: clickable ? "pointer" : "default",
                    transition: "background-color 140ms"
                  }}
                  title={step.label}
                >
                  {step.shortLabel ?? `${step.index}. ${step.label}`}
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <div>{children}</div>
    </div>
  );
}

function SaveIndicator({
  state,
  lastSavedAt
}: {
  state: "idle" | "saving" | "saved" | "error";
  lastSavedAt: Date | null;
}) {
  if (state === "idle" && !lastSavedAt) return null;

  const label = (() => {
    if (state === "saving") return "Guardando...";
    if (state === "error") return "No se pudo guardar";
    if (lastSavedAt) {
      const seconds = Math.max(0, Math.floor((Date.now() - lastSavedAt.getTime()) / 1000));
      if (seconds < 30) return "Guardado";
      if (seconds < 60) return "Guardado hace menos de 1 min";
      return `Guardado hace ${Math.floor(seconds / 60)} min`;
    }
    return "Guardado";
  })();

  const color = state === "error" ? "#b00020" : state === "saving" ? "#1d7fc6" : "#177245";

  return (
    <span
      aria-live="polite"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 13,
        color,
        fontWeight: 600
      }}
    >
      <span
        aria-hidden
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: color,
          animation: state === "saving" ? "wetaskPulse 1.2s infinite" : undefined
        }}
      />
      {label}
    </span>
  );
}
