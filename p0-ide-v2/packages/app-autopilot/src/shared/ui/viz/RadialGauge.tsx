import { cn } from "@quanta/ui-kit/lib";
import "./radial-gauge.css";

export interface RadialGaugeProps {
  /** 0–1 progress. */
  progress: number;
  /** Size in px. Outer diameter. */
  size?: number;
  /** Stroke width in px. */
  stroke?: number;
  /** Color tone. */
  tone?: "neutral" | "good" | "warn" | "bad" | "accent";
  /** Center content. */
  children?: React.ReactNode;
  /** Show tick at 100%. */
  showTarget?: boolean;
  /** Arc sweep — "full" (360°) or "threequarter" (270°, gauge-style). */
  sweep?: "full" | "threequarter";
  className?: string;
}

export function RadialGauge({
  progress,
  size = 120,
  stroke = 10,
  tone = "neutral",
  children,
  showTarget = false,
  sweep = "full",
  className,
}: RadialGaugeProps) {
  const clamped = Math.max(0, Math.min(1, progress));
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const arcFraction = sweep === "full" ? 1 : 0.75;
  const arcLength = circumference * arcFraction;
  const offset = arcLength * (1 - clamped);
  const rotate = sweep === "full" ? -90 : 135;

  return (
    <div className={cn("ap-rgauge", `ap-rgauge--${tone}`, className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <defs>
          <linearGradient id={`ap-rgauge-grad-${tone}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--ap-rg-stop-a)" />
            <stop offset="100%" stopColor="var(--ap-rg-stop-b)" />
          </linearGradient>
        </defs>
        {/* track */}
        <circle
          className="ap-rgauge__track"
          cx={cx}
          cy={cy}
          r={r}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${arcLength} ${circumference}`}
          transform={`rotate(${rotate} ${cx} ${cy})`}
          strokeLinecap="round"
        />
        {/* fill */}
        <circle
          className="ap-rgauge__fill"
          cx={cx}
          cy={cy}
          r={r}
          stroke={`url(#ap-rgauge-grad-${tone})`}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${arcLength} ${circumference}`}
          strokeDashoffset={offset}
          transform={`rotate(${rotate} ${cx} ${cy})`}
          strokeLinecap="round"
        />
        {showTarget && (
          <circle
            className="ap-rgauge__target"
            cx={cx + r * Math.cos((rotate + 360 * arcFraction) * (Math.PI / 180))}
            cy={cy + r * Math.sin((rotate + 360 * arcFraction) * (Math.PI / 180))}
            r={stroke / 1.5}
          />
        )}
      </svg>
      <div className="ap-rgauge__center">{children}</div>
    </div>
  );
}
