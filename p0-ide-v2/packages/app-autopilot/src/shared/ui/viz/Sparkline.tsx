import "./sparkline.css";

export interface SparklineProps {
  values: readonly number[];
  /** Width in px. */
  width?: number;
  /** Height in px. */
  height?: number;
  tone?: "neutral" | "good" | "bad" | "flat";
  /** Target line (horizontal). Drawn in accent. */
  target?: number;
  /** If baseline is set, shaded band between start and baseline value. */
  baseline?: number;
  showEndpoint?: boolean;
}

export function Sparkline({
  values,
  width = 72,
  height = 22,
  tone = "neutral",
  target,
  baseline,
  showEndpoint = true,
}: SparklineProps) {
  if (values.length < 2) {
    return (
      <span
        className="ap-spark ap-spark--empty"
        style={{ width, height }}
        aria-hidden
      />
    );
  }
  const pad = 2;
  const w = width;
  const h = height;
  const allVals = [...values];
  if (target != null) allVals.push(target);
  if (baseline != null) allVals.push(baseline);
  const min = Math.min(...allVals);
  const max = Math.max(...allVals);
  const span = max - min || 1;
  const norm = (v: number) => h - pad - ((v - min) / span) * (h - pad * 2);
  const xs = (i: number) => pad + (i / (values.length - 1)) * (w - pad * 2);

  const d = values.map((v, i) => `${i === 0 ? "M" : "L"} ${xs(i).toFixed(1)} ${norm(v).toFixed(1)}`).join(" ");

  // Fill band (from axis at bottom to line). Subtle.
  const fillD = `${d} L ${(w - pad).toFixed(1)} ${(h - pad).toFixed(1)} L ${pad.toFixed(1)} ${(h - pad).toFixed(1)} Z`;

  const endX = xs(values.length - 1);
  const endY = norm(values[values.length - 1]!);

  return (
    <svg
      className={`ap-spark ap-spark--${tone}`}
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden
    >
      <path className="ap-spark__fill" d={fillD} />
      {target != null && (
        <line
          className="ap-spark__target"
          x1={pad}
          x2={w - pad}
          y1={norm(target)}
          y2={norm(target)}
        />
      )}
      {baseline != null && (
        <line
          className="ap-spark__baseline"
          x1={pad}
          x2={w - pad}
          y1={norm(baseline)}
          y2={norm(baseline)}
          strokeDasharray="2 3"
        />
      )}
      <path className="ap-spark__line" d={d} />
      {showEndpoint && <circle className="ap-spark__end" cx={endX} cy={endY} r={2} />}
    </svg>
  );
}
