import { cn } from "@quanta/ui-kit/lib";
import "./gauge.css";

export interface GaugeProps {
  /** 0–1 progress toward target. */
  progress: number;
  /** Label for the rail, e.g. "cycles: 3 → 0". */
  label?: string;
  /** Semantic tone. Progress bar color. */
  tone?: "neutral" | "good" | "warn" | "bad";
  /** Compact vs full rendering. Compact = bar only. */
  variant?: "bar" | "full";
  /** Shown at right of bar. */
  endBadge?: string;
  className?: string;
}

export function Gauge({
  progress,
  label,
  tone = "neutral",
  variant = "full",
  endBadge,
  className,
}: GaugeProps) {
  const clamped = Math.max(0, Math.min(1, progress));
  const pct = (clamped * 100).toFixed(1);
  return (
    <div className={cn("ap-gauge", `ap-gauge--${variant}`, `ap-gauge--${tone}`, className)}>
      {variant === "full" && label != null && <div className="ap-gauge__label">{label}</div>}
      <div
        className="ap-gauge__rail"
        role="progressbar"
        aria-valuenow={Math.round(clamped * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="ap-gauge__fill" style={{ width: `${pct}%` }} />
        <div className="ap-gauge__tick ap-gauge__tick--target" aria-hidden />
      </div>
      {variant === "full" && (
        <div className="ap-gauge__foot">
          <span className="ap-gauge__pct">{pct}%</span>
          {endBadge != null && <span className="ap-gauge__badge">{endBadge}</span>}
        </div>
      )}
    </div>
  );
}
