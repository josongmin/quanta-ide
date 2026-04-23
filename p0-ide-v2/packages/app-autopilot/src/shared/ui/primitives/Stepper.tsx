import { Check } from "lucide-react";
import { cn } from "@quanta/ui-kit/lib";
import "./stepper.css";

export interface StepperStep {
  id: string;
  label: string;
}

export interface StepperProps {
  steps: readonly StepperStep[];
  activeIndex: number;
  onJump?: (index: number) => void;
  className?: string;
}

export function Stepper({ steps, activeIndex, onJump, className }: StepperProps) {
  return (
    <ol className={cn("ap-stepper", className)} aria-label="Wizard progress">
      {steps.map((s, i) => {
        const state: "done" | "active" | "todo" =
          i < activeIndex ? "done" : i === activeIndex ? "active" : "todo";
        return (
          <li key={s.id} className={cn("ap-stepper__item", `ap-stepper__item--${state}`)}>
            <button
              type="button"
              className="ap-stepper__btn"
              onClick={() => onJump?.(i)}
              disabled={i > activeIndex}
              aria-current={state === "active" ? "step" : undefined}
            >
              <span className="ap-stepper__node">
                {state === "done" ? (
                  <Check size={11} strokeWidth={3} aria-hidden />
                ) : (
                  <span className="ap-stepper__num">{i + 1}</span>
                )}
              </span>
              <span className="ap-stepper__label">{s.label}</span>
            </button>
            {i < steps.length - 1 && <span className="ap-stepper__rail" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}
