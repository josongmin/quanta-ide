import { useMemo } from "react";
import type {
  HorizonDays,
  MetricId,
  Projection,
  Trajectory,
  TrajectoryPoint,
} from "@quanta/app-ide/entities/counterfactual";
import { METRIC_LABEL, METRIC_UNIT } from "@quanta/app-ide/entities/counterfactual";
import "./trajectory-graph.css";

interface Props {
  projection: Projection;
  metric: MetricId;
  horizon: HorizonDays;
  width?: number;
  height?: number;
  showAxes?: boolean;
  compact?: boolean;
}

const PAD = { top: 18, right: 72, bottom: 32, left: 48 };

export function TrajectoryGraph({
  projection,
  metric,
  horizon,
  width = 720,
  height = 260,
  showAxes = true,
  compact = false,
}: Props) {
  const { apply, dismiss } = projection.trajectoriesByMetric[metric];

  const { yMin, yMax, yTicks } = useMemo(() => {
    const values: number[] = [];
    for (const t of [apply, dismiss]) {
      for (const p of t.points) values.push(p.low, p.high, p.median);
    }
    let lo = Math.min(...values);
    let hi = Math.max(...values);
    if (metric === "coverage" || metric === "incident") {
      lo = Math.min(0, lo);
      hi = Math.max(metric === "coverage" ? 100 : 0.6, hi);
    } else {
      lo = Math.floor(Math.min(0, lo) / 10) * 10;
      hi = Math.ceil((hi * 1.05) / 10) * 10;
    }
    const stepsGuess = 5;
    const range = hi - lo;
    const rawStep = range / stepsGuess;
    const magnitude = Math.pow(10, Math.floor(Math.log10(Math.max(rawStep, 0.0001))));
    const step = Math.ceil(rawStep / magnitude) * magnitude;
    const ticks: number[] = [];
    for (let v = Math.floor(lo / step) * step; v <= hi + step / 2; v += step) {
      ticks.push(+v.toFixed(4));
    }
    return { yMin: ticks[0], yMax: ticks[ticks.length - 1], yTicks: ticks };
  }, [apply, dismiss, metric]);

  const xMax = horizon;
  const xTicks = useMemo(() => {
    const steps = Math.min(6, horizon);
    const ticks: number[] = [];
    for (let i = 0; i <= steps; i++) {
      ticks.push(Math.round((i / steps) * horizon));
    }
    return Array.from(new Set(ticks));
  }, [horizon]);

  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;

  const xToPx = (day: number): number => PAD.left + (day / xMax) * innerW;
  const yToPx = (val: number): number => {
    const ratio = (yMax - val) / (yMax - yMin || 1);
    return PAD.top + ratio * innerH;
  };

  const fmtY = (v: number): string => {
    if (metric === "coverage") return `${Math.round(v)}%`;
    if (metric === "incident") return v.toFixed(2);
    return Math.round(v).toString();
  };

  const linePath = (points: TrajectoryPoint[]): string =>
    points
      .map((p, i) => `${i === 0 ? "M" : "L"}${xToPx(p.day).toFixed(2)},${yToPx(p.median).toFixed(2)}`)
      .join(" ");

  const bandPath = (points: TrajectoryPoint[]): string => {
    const top = points
      .map((p, i) => `${i === 0 ? "M" : "L"}${xToPx(p.day).toFixed(2)},${yToPx(p.high).toFixed(2)}`)
      .join(" ");
    const bottom = [...points]
      .reverse()
      .map((p) => `L${xToPx(p.day).toFixed(2)},${yToPx(p.low).toFixed(2)}`)
      .join(" ");
    return `${top} ${bottom} Z`;
  };

  const last = (t: Trajectory): TrajectoryPoint => t.points[t.points.length - 1];
  const applyEnd = last(apply);
  const dismissEnd = last(dismiss);

  return (
    <svg
      className={`cfgraph${compact ? " is-compact" : ""}`}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`${METRIC_LABEL[metric]} trajectory over ${horizon} days`}
    >
      {/* Y axis grid + labels */}
      {showAxes &&
        yTicks.map((t, i) => (
          <g key={`y-${i}`}>
            <line
              className="cfgraph__grid"
              x1={PAD.left}
              x2={width - PAD.right}
              y1={yToPx(t)}
              y2={yToPx(t)}
            />
            <text
              className="cfgraph__ylabel"
              x={PAD.left - 8}
              y={yToPx(t) + 3}
              textAnchor="end"
            >
              {fmtY(t)}
            </text>
          </g>
        ))}

      {/* X axis labels */}
      {showAxes &&
        xTicks.map((d) => (
          <g key={`x-${d}`}>
            <line
              className="cfgraph__xtick"
              x1={xToPx(d)}
              x2={xToPx(d)}
              y1={PAD.top}
              y2={height - PAD.bottom}
            />
            <text
              className="cfgraph__xlabel"
              x={xToPx(d)}
              y={height - PAD.bottom + 14}
              textAnchor="middle"
            >
              {d === 0 ? "now" : `+${d}d`}
            </text>
          </g>
        ))}

      {/* Dismiss band (danger) — drawn first so apply is on top */}
      <path className="cfgraph__band cfgraph__band--dismiss" d={bandPath(dismiss.points)} />
      {/* Apply band (success) */}
      <path className="cfgraph__band cfgraph__band--apply" d={bandPath(apply.points)} />

      {/* Dismiss line */}
      <path className="cfgraph__line cfgraph__line--dismiss" d={linePath(dismiss.points)} />
      {/* Apply line */}
      <path className="cfgraph__line cfgraph__line--apply" d={linePath(apply.points)} />

      {/* Endpoint dots */}
      <circle
        className="cfgraph__dot cfgraph__dot--dismiss"
        cx={xToPx(dismissEnd.day)}
        cy={yToPx(dismissEnd.median)}
        r={4}
      />
      <circle
        className="cfgraph__dot cfgraph__dot--apply"
        cx={xToPx(applyEnd.day)}
        cy={yToPx(applyEnd.median)}
        r={4}
      />

      {/* Endpoint labels */}
      <text
        className="cfgraph__endlabel cfgraph__endlabel--dismiss"
        x={xToPx(dismissEnd.day) + 8}
        y={yToPx(dismissEnd.median) + 3}
      >
        dismiss {fmtY(dismissEnd.median)}
      </text>
      <text
        className="cfgraph__endlabel cfgraph__endlabel--apply"
        x={xToPx(applyEnd.day) + 8}
        y={yToPx(applyEnd.median) + 3}
      >
        apply {fmtY(applyEnd.median)}
      </text>

      {/* "now" marker */}
      <line
        className="cfgraph__now"
        x1={xToPx(0)}
        x2={xToPx(0)}
        y1={PAD.top}
        y2={height - PAD.bottom}
      />

      {/* Y axis unit (top-right) */}
      {showAxes && (
        <text className="cfgraph__unit" x={width - PAD.right + 6} y={PAD.top}>
          {METRIC_UNIT[metric]}
        </text>
      )}
    </svg>
  );
}
