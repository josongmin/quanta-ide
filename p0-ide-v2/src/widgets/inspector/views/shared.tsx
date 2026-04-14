import { type ReactNode } from "react";
import { IconChevron } from "../icons";

export function Sub({
  k,
  v,
  tone = "default",
}: {
  k: string;
  v: string;
  tone?: "default" | "danger" | "warn";
}) {
  return (
    <div className="sub">
      <div className={`sub__v sub__v--${tone}`}>{v}</div>
      <div className="sub__k">{k}</div>
    </div>
  );
}

export function Section({
  label,
  count,
  children,
}: {
  label: string;
  count?: number;
  children: ReactNode;
}) {
  return (
    <section className="insp__section">
      <header className="insp__section-h">
        <span className="insp__section-label">{label}</span>
        {count !== undefined && <span className="insp__section-count">{count}</span>}
        <IconChevron size={12} className="insp__section-chev" />
      </header>
      <div className="insp__section-body">{children}</div>
    </section>
  );
}

export function riskColor(r: number): string {
  if (r >= 70) return "var(--danger)";
  if (r >= 40) return "var(--warn)";
  return "var(--success)";
}

export function riskBarStyle(score: number): React.CSSProperties {
  const opacity = 0.35 + (score / 100) * 0.65;
  return { width: `${score}%`, opacity };
}
