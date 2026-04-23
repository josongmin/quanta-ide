import { cn } from "@quanta/ui-kit/lib";
import "./diff-bar.css";

export interface DiffBarSegment {
  id: string;
  value: number;
  tone?: "neutral" | "accent" | "success" | "warn" | "danger" | "purple";
  label: string;
}

export interface DiffBarProps {
  segments: readonly DiffBarSegment[];
  total?: number;
  height?: number;
  showLegend?: boolean;
  className?: string;
}

export function DiffBar({ segments, total, height = 8, showLegend = true, className }: DiffBarProps) {
  const computed = total ?? segments.reduce((acc, s) => acc + s.value, 0);
  const sum = computed || 1;
  return (
    <div className={cn("ap-diffbar", className)}>
      <div
        className="ap-diffbar__track"
        style={{ height }}
        role="img"
        aria-label={segments.map((s) => `${s.label} ${s.value}`).join(", ")}
      >
        {segments.map((s) => (
          <span
            key={s.id}
            className={cn("ap-diffbar__seg", `ap-diffbar__seg--${s.tone ?? "neutral"}`)}
            style={{ flexBasis: `${(s.value / sum) * 100}%` }}
            title={`${s.label} · ${s.value}`}
          />
        ))}
      </div>
      {showLegend && (
        <ul className="ap-diffbar__legend">
          {segments.map((s) => (
            <li key={s.id}>
              <span
                className={cn("ap-diffbar__dot", `ap-diffbar__seg--${s.tone ?? "neutral"}`)}
                aria-hidden
              />
              <span className="ap-diffbar__legend-label">{s.label}</span>
              <span className="ap-diffbar__legend-value">{s.value}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
