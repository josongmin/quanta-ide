import { useMemo } from "react";
import type { DebtSnapshot } from "@quanta/canvas-engine";
import { computeDebtTrajectory } from "@quanta/canvas-engine";
import { useSceneStore } from "../store/scene-store";
import { interactionStore, useInteractionStore } from "../store/interaction-store";
import { useFeature } from "../store/feature-flags-store";

// Debt trajectory chart — hand-drawn SVG polyline over a computed timeseries
// of per-snapshot debt signals. We render two polylines (primary = scc count,
// secondary = arch violations) so viewers get a two-signal comparison without
// pulling a charting dependency. Clicking a point sets the interaction
// store's snapshot index, so the film strip + dual-split views re-anchor
// to that commit.
//
// Fits inside the "graph" HUD tab — it's small (width follows container,
// height fixed) and only renders when history is present and the feature
// flag is on.

const CHART_HEIGHT = 72;
const PADDING_X = 10;
const PADDING_Y = 8;

export function DebtTrajectoryChart() {
  const enabled = useFeature("archaeology.debtTrajectory");
  const graph = useSceneStore(s => s.graph);
  const activeIndex = useInteractionStore(s => s.temporal.snapshotIndex);

  const series = useMemo<readonly DebtSnapshot[]>(() => {
    if (!graph || !graph.history) return [];
    return computeDebtTrajectory(graph.history, {
      files: graph.files,
      fileEdges: graph.fileEdges,
    });
  }, [graph]);

  if (!enabled) return null;
  if (series.length === 0) return null;

  const viewBox = `0 0 100 ${CHART_HEIGHT}`;

  const maxScc = Math.max(1, ...series.map(s => s.sccCount));
  const maxArch = Math.max(1, ...series.map(s => s.archViolationCount));

  const n = series.length;
  const stride = n > 1 ? (100 - PADDING_X * 2) / (n - 1) : 0;

  const scaleX = (i: number) => PADDING_X + stride * i;
  const scaleYScc = (v: number) =>
    CHART_HEIGHT - PADDING_Y - ((CHART_HEIGHT - PADDING_Y * 2) * v) / maxScc;
  const scaleYArch = (v: number) =>
    CHART_HEIGHT - PADDING_Y - ((CHART_HEIGHT - PADDING_Y * 2) * v) / maxArch;

  // Hand-draw polyline paths. Single-segment path per series.
  const sccPath = polyline(series.map((s, i) => [scaleX(i), scaleYScc(s.sccCount)]));
  const archPath = polyline(series.map((s, i) => [scaleX(i), scaleYArch(s.archViolationCount)]));

  const handleClick = (index: number) => {
    interactionStore.setSnapshotIndex(index);
  };

  return (
    <>
      <div className="ws-debug__divider">debt trajectory</div>
      <div
        style={{
          padding: "4px 6px",
          background: "rgba(15, 23, 42, 0.35)",
          borderRadius: 4,
        }}
      >
        <svg
          viewBox={viewBox}
          preserveAspectRatio="none"
          style={{ width: "100%", height: CHART_HEIGHT, display: "block" }}
          aria-label="debt trajectory line chart"
        >
          {/* Baseline grid */}
          <line
            x1={PADDING_X}
            x2={100 - PADDING_X}
            y1={CHART_HEIGHT - PADDING_Y}
            y2={CHART_HEIGHT - PADDING_Y}
            stroke="rgba(148, 163, 184, 0.25)"
            strokeWidth={0.5}
          />
          {/* arch violations (secondary) */}
          <path
            d={archPath}
            fill="none"
            stroke="#f59e0b"
            strokeWidth={1}
            strokeOpacity={0.7}
            vectorEffect="non-scaling-stroke"
          />
          {/* scc count (primary) */}
          <path
            d={sccPath}
            fill="none"
            stroke="#ea580c"
            strokeWidth={1.25}
            vectorEffect="non-scaling-stroke"
          />
          {series.map((snap, i) => {
            const cx = scaleX(i);
            const cy = scaleYScc(snap.sccCount);
            const isActive = i === activeIndex;
            return (
              <g key={`${snap.sha}-${i}`}>
                {/* Invisible hit target — generous so thin charts stay clickable. */}
                <rect
                  x={cx - Math.max(stride / 2, 1.5)}
                  y={0}
                  width={Math.max(stride, 3)}
                  height={CHART_HEIGHT}
                  fill="transparent"
                  style={{ cursor: "pointer" }}
                  onClick={() => handleClick(i)}
                >
                  <title>
                    {`${snap.sha.slice(0, 7)} · cycles ${snap.sccCount} · arch ${snap.archViolationCount}`}
                  </title>
                </rect>
                <circle
                  cx={cx}
                  cy={cy}
                  r={isActive ? 2.2 : 1.3}
                  fill={isActive ? "#facc15" : "#ea580c"}
                  stroke={isActive ? "#fef08a" : "none"}
                  strokeWidth={isActive ? 0.6 : 0}
                  pointerEvents="none"
                />
              </g>
            );
          })}
        </svg>
        <div
          className="ws-debug__row"
          style={{ fontSize: 10, opacity: 0.7, gap: 8, marginTop: 2 }}
        >
          <span style={{ color: "#ea580c" }}>cycles</span>
          <span style={{ color: "#f59e0b" }}>arch violations</span>
          <span style={{ marginLeft: "auto" }}>
            {series.length} snapshots · max cycles {maxScc}
          </span>
        </div>
      </div>
    </>
  );
}

function polyline(points: readonly (readonly [number, number])[]): string {
  if (points.length === 0) return "";
  let d = `M ${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${points[i][0].toFixed(2)} ${points[i][1].toFixed(2)}`;
  }
  return d;
}
