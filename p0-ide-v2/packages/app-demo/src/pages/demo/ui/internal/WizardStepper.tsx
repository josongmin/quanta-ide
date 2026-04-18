import type { JSX } from "react";
import { StepCircle, type StepState } from "./StepCircle";

export interface WizardStep {
  id: string;
  title: string;
}

interface WizardStepperProps {
  steps: readonly WizardStep[];
  activeIdx: number;
  onChange: (idx: number) => void;
  ariaLabel?: string;
}

export function WizardStepper({
  steps,
  activeIdx,
  onChange,
  ariaLabel = "Setup progress",
}: WizardStepperProps): JSX.Element {
  return (
    <nav
      role="navigation"
      aria-label={ariaLabel}
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${steps.length}, 1fr)`,
        gap: 0,
        marginBottom: "var(--space-5)",
      }}
    >
      {steps.map((s, i) => {
        const state: StepState =
          i < activeIdx ? "done" : i === activeIdx ? "current" : "upcoming";
        const connectorActive = i < activeIdx;

        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onChange(i)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
              position: "relative",
              background: "transparent",
              border: 0,
              padding: 0,
              textAlign: "left",
              cursor: "pointer",
            }}
            aria-current={i === activeIdx ? "step" : undefined}
          >
            <StepCircle n={i + 1} state={state} size={32} />
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: "var(--fs-10)",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  fontWeight: 700,
                  color: i <= activeIdx ? "var(--fg-muted)" : "var(--fg-subtle)",
                }}
              >
                Step {i + 1}
              </div>
              <div
                style={{
                  fontSize: "var(--fs-sm)",
                  fontWeight: i === activeIdx ? 700 : 500,
                  color: "var(--fg)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {s.title}
              </div>
            </div>
            {i < steps.length - 1 && (
              <span
                style={{
                  position: "absolute",
                  left: 32,
                  right: -12,
                  top: 15,
                  height: 1,
                  background: connectorActive ? "var(--fg)" : "var(--border)",
                }}
                aria-hidden
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}
