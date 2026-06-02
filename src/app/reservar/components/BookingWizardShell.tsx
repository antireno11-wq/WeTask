"use client";

import type { ReactNode } from "react";
import type { WizardStep } from "../useBookingWizard";

const STEPS: Array<{ key: WizardStep; label: string; index: number }> = [
  { key: "service", label: "Servicio", index: 1 },
  { key: "schedule", label: "Horario", index: 2 },
  { key: "payment", label: "Pago", index: 3 }
];

type Props = {
  currentStep: WizardStep;
  onStepClick?: (step: WizardStep) => void;
  children: ReactNode;
  summary?: ReactNode;
};

export function BookingWizardShell({ currentStep, onStepClick, children, summary }: Props) {
  const currentIndex = STEPS.findIndex((s) => s.key === currentStep);
  const isSuccess = currentStep === "success";

  return (
    <div style={{ display: "grid", gridTemplateColumns: summary ? "minmax(0, 1fr) 320px" : "1fr", gap: 24, alignItems: "start" }}>
      <div>
        <nav
          aria-label="Pasos de la reserva"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 0,
            padding: "14px 18px",
            background: "#ffffff",
            borderRadius: 18,
            border: "1px solid rgba(34,97,160,0.18)",
            marginBottom: 20
          }}
        >
          {STEPS.map((step, idx) => {
            const isActive = step.key === currentStep;
            const isDone = currentIndex > idx || isSuccess;
            const clickable = Boolean(onStepClick) && idx < currentIndex;
            const dotColor = isDone ? "#177245" : isActive ? "#18a6d5" : "#cdddee";
            return (
              <div key={step.key} style={{ display: "flex", alignItems: "center", flex: 1 }}>
                <button
                  type="button"
                  onClick={clickable ? () => onStepClick!(step.key) : undefined}
                  disabled={!clickable}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 10,
                    border: 0,
                    background: "transparent",
                    cursor: clickable ? "pointer" : "default",
                    padding: 0,
                    color: isActive ? "#17324d" : isDone ? "#177245" : "#5f7691",
                    font: "inherit"
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 30,
                      height: 30,
                      borderRadius: 999,
                      background: dotColor,
                      color: isDone || isActive ? "#ffffff" : "#5f7691",
                      fontWeight: 800,
                      fontSize: 13
                    }}
                  >
                    {isDone ? "✓" : step.index}
                  </span>
                  <span style={{ fontWeight: isActive ? 700 : 500, fontSize: 14 }}>{step.label}</span>
                </button>
                {idx < STEPS.length - 1 ? (
                  <div
                    aria-hidden
                    style={{
                      flex: 1,
                      height: 2,
                      margin: "0 12px",
                      background: currentIndex > idx ? "#177245" : "#cdddee",
                      borderRadius: 2
                    }}
                  />
                ) : null}
              </div>
            );
          })}
        </nav>

        {children}
      </div>

      {summary ? <div style={{ display: "block" }}>{summary}</div> : null}
    </div>
  );
}
