import { useMemo } from "react";
import { useSceneStore } from "../store/scene-store";
import { useFeature } from "../store/feature-flags-store";
import { interactionStore } from "../store/interaction-store";
import { figmaModeStore, useFigmaMode } from "../store/figma-mode-store";
import {
  LANE_COLOR,
  LANE_ORDER,
  computeConstellationLayout,
  type ConstellationEdge,
  type ConstellationLane,
} from "../lib/constellation-layout";

// Constellation view (R1) — Figma-style architecture lanes overlay.
// -------------------------------------------------------------------
// Rendered as a full-canvas SVG overlay when the shell mode is
// `analyze`. Five horizontal lanes (ui/adapter/domain/infra/util) host
// the top-N files per layer, ordered by degree; cross-lane edges are
// drawn as cubic bezier arcs with violations coloured red. Click a
// file card → select it and drop the overlay so the user lands on
// the canvas already focused.
//
// The overlay is read-only on the rest of the shell: it doesn't
// mutate render-settings, LOD, or focus. This keeps the "enter
// analyze, leave, resume exploration" flow snappy.

const CARD_W = 140;
const CARD_H = 48;
const CARD_GAP = 18;
const LANE_H = 130;
const LANE_PAD_X = 60;
const TOP_PAD = 80;
const BOTTOM_PAD = 60;

export function ConstellationView() {
  const enabled = useFeature("power.figmaShell");
  const mode = useFigmaMode(s => s.mode);
  const graph = useSceneStore(s => s.graph);

  const active = enabled && mode === "analyze";
  const layout = useMemo(() => {
    if (!active || !graph) return null;
    return computeConstellationLayout(graph, { maxPerLane: 14 });
  }, [active, graph]);

  if (!active || !layout) return null;

  const laneTop = (laneIdx: number) => TOP_PAD + laneIdx * LANE_H;

  const anchors = new Map<string, { cx: number; cy: number }>();
  layout.lanes.forEach((lane, laneIdx) => {
    lane.files.forEach((slot, i) => {
      const cx = LANE_PAD_X + i * (CARD_W + CARD_GAP) + CARD_W / 2;
      const cy = laneTop(laneIdx) + CARD_H / 2 + 36;
      anchors.set(slot.fileId, { cx, cy });
    });
  });

  const width = Math.max(
    960,
    ...layout.lanes.map(l => LANE_PAD_X * 2 + Math.max(1, l.files.length) * (CARD_W + CARD_GAP)),
  );
  const height = TOP_PAD + LANE_ORDER.length * LANE_H + BOTTOM_PAD;

  const close = () => figmaModeStore.setMode("explore");

  return (
    <div className="ws-constellation" role="dialog" aria-label="Constellation view">
      <div className="ws-constellation__head">
        <div className="ws-constellation__title">
          <span className="ws-constellation__eyebrow">Constellation</span>
          <span className="ws-constellation__sub">
            {layout.lanes.reduce((s, l) => s + l.count, 0).toLocaleString()} files ·
            {" "}
            {layout.violationCount.toLocaleString()} arch violations
          </span>
        </div>
        {layout.violationCount > 0 && <ViolationPills byPair={layout.byPair} />}
        <button type="button" className="ws-constellation__close" onClick={close}>
          Close ⏎
        </button>
      </div>
      <div className="ws-constellation__body">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="ws-constellation__svg"
        >
          {layout.lanes.map((lane, laneIdx) => (
            <LaneBlock key={lane.layer} lane={lane} laneIdx={laneIdx} width={width} />
          ))}
          {layout.edges.map(e => (
            <EdgeArc key={e.id} edge={e} anchors={anchors} />
          ))}
          {layout.lanes.map((lane, _laneIdx) =>
            lane.files.map((slot, _i) => {
              const a = anchors.get(slot.fileId);
              if (!a) return null;
              return (
                <g
                  key={slot.fileId}
                  className="ws-constellation__card"
                  transform={`translate(${a.cx - CARD_W / 2}, ${a.cy - CARD_H / 2})`}
                  onClick={() => {
                    interactionStore.selectFile(slot.fileId);
                    figmaModeStore.setMode("explore");
                  }}
                  style={{ cursor: "pointer" }}
                  tabIndex={0}
                >
                  <rect
                    width={CARD_W}
                    height={CARD_H}
                    rx={6}
                    fill="rgba(15,23,42,0.85)"
                    stroke={slot.hasViolation ? "#ef4444" : "rgba(148,163,184,0.3)"}
                    strokeWidth={slot.hasViolation ? 1.5 : 1}
                  />
                  <rect
                    x={0}
                    y={0}
                    width={4}
                    height={CARD_H}
                    rx={2}
                    fill={LANE_COLOR[slot.layer]}
                  />
                  <text x={14} y={18} className="ws-constellation__card-name">
                    {truncate(slot.name, 18)}
                  </text>
                  <text x={14} y={34} className="ws-constellation__card-meta">
                    deg {slot.degree} · risk {(slot.riskScore * 100).toFixed(0)}
                  </text>
                </g>
              );
            }),
          )}
        </svg>
      </div>
    </div>
  );
}

function LaneBlock({
  lane,
  laneIdx,
  width,
}: {
  lane: ConstellationLane;
  laneIdx: number;
  width: number;
}) {
  const top = TOP_PAD + laneIdx * LANE_H;
  return (
    <g className="ws-constellation__lane">
      <rect
        x={0}
        y={top + 12}
        width={width}
        height={LANE_H - 18}
        fill={`${LANE_COLOR[lane.layer]}12`}
        stroke={`${LANE_COLOR[lane.layer]}33`}
      />
      <text
        x={LANE_PAD_X - 12}
        y={top + 22}
        className="ws-constellation__lane-lbl"
        fill={LANE_COLOR[lane.layer]}
      >
        {lane.layer.toUpperCase()} · {lane.count}
        {lane.outboundViolations > 0 && ` · ⚠ ${lane.outboundViolations}`}
      </text>
    </g>
  );
}

function EdgeArc({
  edge,
  anchors,
}: {
  edge: ConstellationEdge;
  anchors: ReadonlyMap<string, { cx: number; cy: number }>;
}) {
  const a = anchors.get(edge.from);
  const b = anchors.get(edge.to);
  if (!a || !b) return null;
  const dx = b.cx - a.cx;
  const midX = a.cx + dx / 2;
  const dir = b.cy > a.cy ? 1 : -1;
  const arc = Math.max(40, Math.abs(dx) * 0.18) * dir;
  const path = `M ${a.cx} ${a.cy} C ${midX} ${a.cy + arc} ${midX} ${b.cy - arc} ${b.cx} ${b.cy}`;
  return (
    <path
      d={path}
      fill="none"
      stroke={edge.violating ? "#ef4444" : "rgba(125,211,252,0.5)"}
      strokeWidth={edge.violating ? 1.5 : 0.8}
      strokeOpacity={edge.violating ? 0.9 : 0.5}
      strokeDasharray={edge.violating ? "4 3" : undefined}
    />
  );
}

function ViolationPills({ byPair }: { byPair: ReadonlyMap<string, number> }) {
  const rows = useMemo(() => {
    return [...byPair.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [byPair]);
  if (rows.length === 0) return null;
  return (
    <div className="ws-constellation__violations">
      {rows.map(([pair, count]) => (
        <span key={pair} className="ws-constellation__vio-pill">
          {pair} × {count}
        </span>
      ))}
    </div>
  );
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}
