import { useId, useMemo } from "react";

interface WatcherSparklineProps {
  series: readonly number[];
  startLabel?: string;
  endLabel?: string;
  inFlux?: boolean;
  peak?: number;
}

const VW = 240;
const VH = 56;
const PY = 6;
const PX = 2;

interface SparkData {
  linePath: string;
  areaPath: string;
  lastPt: { x: number; y: number } | null;
  points: { x: number; y: number }[];
}

function build(series: readonly number[]): SparkData {
  if (series.length === 0) {
    return { linePath: "", areaPath: "", lastPt: null, points: [] };
  }

  if (series.length === 1) {
    const y = VH / 2;
    return {
      linePath: `M ${PX} ${y} L ${VW - PX} ${y}`,
      areaPath: `M ${PX} ${y} L ${VW - PX} ${y} L ${VW - PX} ${VH} L ${PX} ${VH} Z`,
      lastPt: { x: VW - PX, y },
      points: [{ x: PX, y }, { x: VW - PX, y }],
    };
  }

  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || 1;
  const usableW = VW - PX * 2;
  const usableH = VH - PY * 2;
  const step = usableW / (series.length - 1);

  const pts = series.map((v, i) => ({
    x: PX + i * step,
    y: PY + (1 - (v - min) / range) * usableH,
  }));

  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${pts[pts.length - 1].x.toFixed(1)} ${VH} L ${pts[0].x.toFixed(1)} ${VH} Z`;

  return { linePath, areaPath, lastPt: pts[pts.length - 1], points: pts };
}

export function WatcherSparkline({
  series,
  startLabel,
  endLabel,
  inFlux = false,
  peak,
}: WatcherSparklineProps) {
  const gradId = useId();
  const titleId = useId();
  const { linePath, areaPath, lastPt, points } = useMemo(() => build(series), [series]);

  if (series.length === 0) {
    return (
      <div className="wt-spark wt-spark-empty" aria-label="Sparkline (no data)">
        <span className="wt-spark-empty-text">no data yet</span>
      </div>
    );
  }

  /* mid-point label */
  const midIdx = Math.floor(series.length / 2);
  const midVal = series[midIdx];
  const midPt = points[midIdx];

  return (
    <div className="wt-spark">
      <div className="wt-spark-head">
        <span className="wt-spark-title">Blast Radius Trend</span>
        {peak !== undefined && (
          <span className="wt-spark-peak">peak {peak}</span>
        )}
      </div>

      <svg
        className="wt-spark-svg"
        viewBox={`0 0 ${VW} ${VH}`}
        preserveAspectRatio="none"
        role="img"
        aria-labelledby={titleId}
      >
        <title id={titleId}>Blast radius trend</title>

        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--wt-spark-fill-a)" />
            <stop offset="100%" stopColor="var(--wt-spark-fill-b)" />
          </linearGradient>
        </defs>

        {/* area fill */}
        <path
          className="wt-spark-area"
          d={areaPath}
          fill={`url(#${gradId})`}
        />

        {/* grid hints — horizontal */}
        <line className="wt-spark-grid" x1={PX} y1={PY} x2={VW - PX} y2={PY} />
        <line className="wt-spark-grid" x1={PX} y1={VH / 2} x2={VW - PX} y2={VH / 2} />
        <line className="wt-spark-grid" x1={PX} y1={VH - PY} x2={VW - PX} y2={VH - PY} />

        {/* line */}
        <path
          className={`wt-spark-line${inFlux ? " is-in-flux" : ""}`}
          d={linePath}
          fill="none"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />

        {/* dot markers at start, mid, end */}
        {points.length > 0 && (
          <circle className="wt-spark-dot" cx={points[0].x} cy={points[0].y} r={2.5}
            vectorEffect="non-scaling-stroke" />
        )}
        <circle className="wt-spark-dot wt-spark-dot-mid" cx={midPt.x} cy={midPt.y} r={2}
          vectorEffect="non-scaling-stroke" />
        {lastPt && (
          <circle className="wt-spark-end" cx={lastPt.x} cy={lastPt.y} r={3}
            vectorEffect="non-scaling-stroke" />
        )}
      </svg>

      <div className="wt-spark-labels">
        {startLabel !== undefined ? (
          <span className="wt-spark-label-start">{startLabel}</span>
        ) : <span />}
        <span className="wt-spark-label-mid">{midVal}</span>
        {endLabel !== undefined ? (
          <span className="wt-spark-label-end">{endLabel}</span>
        ) : <span />}
      </div>
    </div>
  );
}
