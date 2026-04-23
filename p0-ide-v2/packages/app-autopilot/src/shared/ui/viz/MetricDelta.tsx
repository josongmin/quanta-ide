import { cn } from "@quanta/ui-kit/lib";
import { findMetric, formatMetricValue, formatMetricDelta } from "@quanta/app-autopilot/entities/metric";
import "./metric-delta.css";

export interface MetricDeltaProps {
  metric: string;
  before: number;
  after: number;
  /** Compact row (inline) or stacked (card) layout. */
  layout?: "inline" | "stacked";
  className?: string;
}

export function MetricDelta({
  metric,
  before,
  after,
  layout = "inline",
  className,
}: MetricDeltaProps) {
  const def = findMetric(metric);
  const unit = def?.unit ?? "count";
  const { text, tone } = formatMetricDelta(before, after, def);
  return (
    <div className={cn("ap-mdelta", `ap-mdelta--${layout}`, `ap-mdelta--${tone}`, className)}>
      <div className="ap-mdelta__name">{def?.name ?? metric}</div>
      <div className="ap-mdelta__nums">
        <span className="ap-mdelta__before">{formatMetricValue(before, unit)}</span>
        <span className="ap-mdelta__arrow" aria-hidden>→</span>
        <span className="ap-mdelta__after">{formatMetricValue(after, unit)}</span>
        <span className="ap-mdelta__delta" data-tone={tone}>{text}</span>
      </div>
    </div>
  );
}
