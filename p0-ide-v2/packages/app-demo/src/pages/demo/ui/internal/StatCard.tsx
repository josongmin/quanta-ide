import type { ReactNode } from "react";
import { cn } from "@quanta/ui-kit/lib";

export type StatDeltaTone = "up" | "down" | "neutral";

interface StatCardProps {
  label: string;
  value: string;
  icon?: ReactNode;
  delta?: string;
  deltaTone?: StatDeltaTone;
  chart?: ReactNode;
}

export function StatCard({
  label,
  value,
  icon,
  delta,
  deltaTone = "neutral",
  chart,
}: StatCardProps) {
  const deltaGlyph = deltaTone === "up" ? "▲" : deltaTone === "down" ? "▼" : "";

  return (
    <div className="demo-stat">
      {icon !== undefined ? (
        <div
          className="demo-stat__label"
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <span style={{ color: "var(--fg-muted)" }}>{icon}</span>
          {label}
        </div>
      ) : (
        <div className="demo-stat__label">{label}</div>
      )}
      <div className="demo-stat__value">{value}</div>
      {delta !== undefined ? (
        <div
          className={cn(
            "demo-stat__delta",
            deltaTone === "up" && "is-up",
            deltaTone === "down" && "is-down",
          )}
        >
          {deltaGlyph ? `${deltaGlyph} ${delta}` : delta}
        </div>
      ) : null}
      {chart !== undefined ? <div style={{ marginTop: 8 }}>{chart}</div> : null}
    </div>
  );
}
