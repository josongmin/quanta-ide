import { useId, useMemo } from "react";

interface WatcherSparklineProps {
  /** 시계열 정수. 비어 있으면 placeholder. */
  series: readonly number[];
  /** sparkline 우측 라벨용 시작값. */
  startLabel?: string;
  /** sparkline 우측 라벨용 종료값. */
  endLabel?: string;
  /** in-flux 표시. true면 끝부분 점선. */
  inFlux?: boolean;
}

const VIEWBOX_W = 200;
const VIEWBOX_H = 40;
const PADDING_Y = 4;

interface PolylineData {
  path: string;
  lastPoint: { x: number; y: number } | null;
}

function buildPolyline(series: readonly number[]): PolylineData {
  if (series.length === 0) return { path: "", lastPoint: null };
  if (series.length === 1) {
    const y = VIEWBOX_H / 2;
    return { path: `M 0 ${String(y)} L ${String(VIEWBOX_W)} ${String(y)}`, lastPoint: { x: VIEWBOX_W, y } };
  }

  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || 1;
  const stepX = VIEWBOX_W / (series.length - 1);
  const usableH = VIEWBOX_H - PADDING_Y * 2;

  const points = series.map((v, i) => {
    const x = i * stepX;
    const norm = (v - min) / range;
    // 큰 값이 위로 가도록 반전
    const y = PADDING_Y + (1 - norm) * usableH;
    return { x, y };
  });

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");

  return { path, lastPoint: points[points.length - 1] ?? null };
}

/**
 * Column 2 — Sparkline
 * blast radius 시계열을 SVG polyline으로 렌더.
 * in-flux 시 끝부분이 점선(stroke-dasharray)으로 마지막 신뢰 구간만 강조.
 */
export function WatcherSparkline({
  series,
  startLabel,
  endLabel,
  inFlux = false,
}: WatcherSparklineProps) {
  const titleId = useId();
  const { path, lastPoint } = useMemo(() => buildPolyline(series), [series]);

  if (series.length === 0) {
    return (
      <div className="wt-spark wt-spark-empty" aria-label="Sparkline (no data)">
        <span className="wt-spark-empty-text">no data yet</span>
      </div>
    );
  }

  return (
    <div className="wt-spark">
      <svg
        className="wt-spark-svg"
        viewBox={`0 0 ${String(VIEWBOX_W)} ${String(VIEWBOX_H)}`}
        preserveAspectRatio="none"
        role="img"
        aria-labelledby={titleId}
      >
        <title id={titleId}>Blast radius trend</title>
        <path
          className={`wt-spark-line${inFlux ? " is-in-flux" : ""}`}
          d={path}
          fill="none"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
        {lastPoint !== null ? (
          <circle
            className="wt-spark-end"
            cx={lastPoint.x}
            cy={lastPoint.y}
            r={2}
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </svg>
      <div className="wt-spark-labels">
        {startLabel !== undefined ? <span>{startLabel}</span> : <span />}
        <span className="wt-spark-arrow" aria-hidden>→</span>
        {endLabel !== undefined ? <span className="wt-spark-end-label">{endLabel}</span> : <span />}
      </div>
    </div>
  );
}
