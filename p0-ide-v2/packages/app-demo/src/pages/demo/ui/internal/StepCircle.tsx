import type { JSX } from "react";
import { Check } from "lucide-react";

export type StepState = "upcoming" | "current" | "done";

interface StepCircleProps {
  n: number;
  state?: StepState;
  size?: 24 | 28 | 32;
}

export function StepCircle({ n, state = "upcoming", size = 28 }: StepCircleProps): JSX.Element {
  const iconSize = Math.round(size * 0.45);

  const background =
    state === "done" || state === "current" ? "var(--fg)" : "var(--bg-muted)";
  const color =
    state === "done" || state === "current" ? "var(--bg)" : "var(--fg-subtle)";
  const boxShadow =
    state === "current" ? "0 0 0 3px var(--bg-accent-subtle)" : "none";

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background,
        color,
        border: "2px solid var(--bg)",
        boxShadow,
        fontWeight: 700,
        fontSize: "var(--fs-xs)",
        flex: "0 0 auto",
        zIndex: 1,
      }}
    >
      {state === "done" ? <Check size={iconSize} strokeWidth={2.4} /> : n}
    </div>
  );
}
