import { useMemo, useState } from "react";
import "./concurrency-pane.css";
import type { FileFacts } from "@quanta/app-ide/entities/file";
import {
  getConcurrencyMap,
  type Access,
  type ConcurrencyMap,
  type Lane,
  type LockInterval,
  type RacePair,
} from "@quanta/app-ide/entities/concurrency";

const LANE_KIND_GLYPH: Record<Lane["kind"], string> = {
  thread: "⬢", // ⬢
  async: "◐",  // ◐
  actor: "◇",  // ◇
};

const LANE_KIND_LABEL: Record<Lane["kind"], string> = {
  thread: "thread",
  async: "async",
  actor: "actor",
};

// Swimlane geometry — shared between <svg> and hit-testing math.
const LANE_H = 54;
const LANE_GUTTER = 120;
const TIMELINE_PAD_X = 16;
const ACCESS_R = 5.5;

// Lock-order DAG geometry
const DAG_SIZE = 180;
const DAG_NODE_R = 18;

/** Stable color-ish tint per lock id via a simple hash → lightness sweep. */
function lockHue(lockId: string): number {
  let h = 0;
  for (let i = 0; i < lockId.length; i += 1) h = (h * 31 + lockId.charCodeAt(i)) >>> 0;
  return h % 360;
}

function laneY(laneIndex: number): number {
  return laneIndex * LANE_H + LANE_H / 2;
}

function timeToX(t: number, width: number): number {
  const usable = width - TIMELINE_PAD_X * 2;
  return TIMELINE_PAD_X + t * usable;
}

/** Index lanes → row for geometry. */
function useLaneIndex(lanes: Lane[]): Map<string, number> {
  return useMemo(() => {
    const m = new Map<string, number>();
    lanes.forEach((l, i) => m.set(l.id, i));
    return m;
  }, [lanes]);
}

function severityPipClass(s: RacePair["severity"]): string {
  return `concur-pane__pip concur-pane__pip--${s}`;
}

interface RacesByAccessIndex {
  byAccess: Map<string, RacePair[]>;
}

function indexRaces(races: RacePair[]): RacesByAccessIndex {
  const byAccess = new Map<string, RacePair[]>();
  for (const r of races) {
    const existingA = byAccess.get(r.aId);
    if (existingA) existingA.push(r);
    else byAccess.set(r.aId, [r]);
    const existingB = byAccess.get(r.bId);
    if (existingB) existingB.push(r);
    else byAccess.set(r.bId, [r]);
  }
  return { byAccess };
}

function accessById(accesses: Access[]): Map<string, Access> {
  const m = new Map<string, Access>();
  for (const a of accesses) m.set(a.id, a);
  return m;
}

interface EmptyViewProps {
  fileName: string;
}

function EmptyView({ fileName }: EmptyViewProps) {
  return (
    <div className="concur-pane concur-pane--empty">
      <div className="concur-pane__empty-body">
        <div className="concur-pane__empty-title">No concurrency model</div>
        <div className="concur-pane__empty-hint">
          Happens-before analysis has no shared-state accesses for{" "}
          <code className="concur-pane__mono">{fileName}</code>.
        </div>
      </div>
    </div>
  );
}

interface SwimlaneProps {
  map: ConcurrencyMap;
  hoveredAccessId: string | null;
  selectedRaceKey: string | null;
  onHoverAccess: (id: string | null) => void;
}

function raceKey(r: RacePair): string {
  return `${r.aId}__${r.bId}`;
}

function Swimlane({ map, hoveredAccessId, selectedRaceKey, onHoverAccess }: SwimlaneProps) {
  const laneIdx = useLaneIndex(map.lanes);
  const accesses = useMemo(() => accessById(map.accesses), [map.accesses]);
  const racesIdx = useMemo(() => indexRaces(map.races), [map.races]);

  const width = 640; // intrinsic; CSS stretches via viewBox preserveAspectRatio
  const height = map.lanes.length * LANE_H + 8;

  // Which accesses participate in which races — used for highlight.
  const relatedAccessIds = useMemo(() => {
    const s = new Set<string>();
    if (hoveredAccessId) {
      const pairs = racesIdx.byAccess.get(hoveredAccessId);
      if (pairs) {
        for (const r of pairs) {
          s.add(r.aId);
          s.add(r.bId);
        }
      }
    }
    return s;
  }, [hoveredAccessId, racesIdx]);

  return (
    <svg
      className="concur-pane__svg"
      viewBox={`0 0 ${width + LANE_GUTTER} ${height}`}
      preserveAspectRatio="xMinYMid meet"
      role="img"
      aria-label="Concurrency swimlane"
    >
      {/* Lane baselines + gutter labels */}
      {map.lanes.map((lane, i) => {
        const y = laneY(i);
        return (
          <g key={lane.id} className="concur-pane__lane">
            <text
              x={LANE_GUTTER - 12}
              y={y - 8}
              className="concur-pane__lane-label"
              textAnchor="end"
            >
              {lane.label}
            </text>
            <text
              x={LANE_GUTTER - 12}
              y={y + 7}
              className="concur-pane__lane-kind"
              textAnchor="end"
            >
              <tspan className="concur-pane__lane-glyph">{LANE_KIND_GLYPH[lane.kind]}</tspan>
              {"  "}
              {LANE_KIND_LABEL[lane.kind]}
            </text>
            <line
              x1={LANE_GUTTER}
              x2={LANE_GUTTER + width}
              y1={y}
              y2={y}
              className="concur-pane__baseline"
            />
          </g>
        );
      })}

      {/* Lock intervals — translucent tinted blocks */}
      <g>
        {map.lockIntervals.map((iv: LockInterval, i) => {
          const row = laneIdx.get(iv.laneId);
          if (row === undefined) return null;
          const y = laneY(row);
          const x1 = LANE_GUTTER + timeToX(iv.tStart, width);
          const x2 = LANE_GUTTER + timeToX(iv.tEnd, width);
          const hue = lockHue(iv.lockId);
          return (
            <g key={`lk-${i}`} className="concur-pane__lock-iv">
              <rect
                x={x1}
                y={y - 14}
                width={Math.max(2, x2 - x1)}
                height={28}
                rx={3}
                style={{ fill: `hsl(${hue} 60% 55%)` }}
                className="concur-pane__lock-rect"
              />
              <text
                x={(x1 + x2) / 2}
                y={y - 17}
                textAnchor="middle"
                className="concur-pane__lock-name"
              >
                {map.locks.find((l) => l.id === iv.lockId)?.name ?? iv.lockId}
              </text>
            </g>
          );
        })}
      </g>

      {/* Race arcs */}
      <g>
        {map.races.map((r) => {
          const a = accesses.get(r.aId);
          const b = accesses.get(r.bId);
          if (!a || !b) return null;
          const rowA = laneIdx.get(a.laneId);
          const rowB = laneIdx.get(b.laneId);
          if (rowA === undefined || rowB === undefined) return null;
          const xA = LANE_GUTTER + timeToX(a.time, width);
          const yA = laneY(rowA);
          const xB = LANE_GUTTER + timeToX(b.time, width);
          const yB = laneY(rowB);
          const midX = (xA + xB) / 2;
          const midY = Math.min(yA, yB) - Math.abs(rowA - rowB) * 10 - 18;
          const d = `M ${xA} ${yA} Q ${midX} ${midY} ${xB} ${yB}`;
          const key = raceKey(r);
          const highlighted =
            selectedRaceKey === key ||
            (hoveredAccessId !== null &&
              (hoveredAccessId === r.aId || hoveredAccessId === r.bId));
          return (
            <path
              key={key}
              d={d}
              className={
                "concur-pane__arc" +
                (highlighted ? " is-highlight" : "") +
                ` concur-pane__arc--${r.severity}`
              }
            />
          );
        })}
      </g>

      {/* Access markers */}
      <g>
        {map.accesses.map((ac) => {
          const row = laneIdx.get(ac.laneId);
          if (row === undefined) return null;
          const x = LANE_GUTTER + timeToX(ac.time, width);
          const y = laneY(row);
          const inRace = racesIdx.byAccess.has(ac.id);
          const isRelated = relatedAccessIds.has(ac.id);
          const cls =
            "concur-pane__access" +
            (ac.kind === "write" ? " is-write" : " is-read") +
            (inRace ? " in-race" : "") +
            (isRelated ? " is-highlight" : "");
          return (
            <g
              key={ac.id}
              className={cls}
              onMouseEnter={() => onHoverAccess(ac.id)}
              onMouseLeave={() => onHoverAccess(null)}
            >
              <circle cx={x} cy={y} r={ACCESS_R} />
              <text
                x={x}
                y={y + ACCESS_R + 11}
                className="concur-pane__line"
                textAnchor="middle"
              >
                L{ac.line}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

interface DagProps {
  map: ConcurrencyMap;
}

function LockOrderDag({ map }: DagProps) {
  const nodes = map.locks;
  const cycleEdgeSet = useMemo(() => {
    const s = new Set<string>();
    for (const cyc of map.deadlockCycles) {
      for (let i = 0; i < cyc.length - 1; i += 1) s.add(`${cyc[i]}__${cyc[i + 1]}`);
    }
    return s;
  }, [map.deadlockCycles]);

  // Circular layout
  const positions = useMemo(() => {
    const pos = new Map<string, { x: number; y: number }>();
    if (nodes.length === 0) return pos;
    const cx = DAG_SIZE / 2;
    const cy = DAG_SIZE / 2;
    const r = DAG_SIZE / 2 - DAG_NODE_R - 8;
    if (nodes.length === 1) {
      pos.set(nodes[0].id, { x: cx, y: cy });
      return pos;
    }
    nodes.forEach((n, i) => {
      const angle = (i / nodes.length) * Math.PI * 2 - Math.PI / 2;
      pos.set(n.id, { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
    });
    return pos;
  }, [nodes]);

  if (nodes.length === 0) {
    return (
      <div className="concur-pane__dag concur-pane__dag--empty">
        <div className="concur-pane__dag-empty">no locks tracked</div>
      </div>
    );
  }

  return (
    <svg
      className="concur-pane__dag-svg"
      viewBox={`0 0 ${DAG_SIZE} ${DAG_SIZE}`}
      role="img"
      aria-label="Lock-order DAG"
    >
      <defs>
        <marker
          id="concur-arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" className="concur-pane__arrow-head" />
        </marker>
        <marker
          id="concur-arrow-danger"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" className="concur-pane__arrow-head is-danger" />
        </marker>
      </defs>

      {/* Edges */}
      <g>
        {map.lockOrder.map((e, i) => {
          const a = positions.get(e.fromLock);
          const b = positions.get(e.toLock);
          if (!a || !b) return null;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const ux = dx / len;
          const uy = dy / len;
          const x1 = a.x + ux * DAG_NODE_R;
          const y1 = a.y + uy * DAG_NODE_R;
          const x2 = b.x - ux * DAG_NODE_R;
          const y2 = b.y - uy * DAG_NODE_R;
          // Offset curve so reverse edges don't overlap
          const midX = (x1 + x2) / 2 - uy * 14;
          const midY = (y1 + y2) / 2 + ux * 14;
          const isCycle = cycleEdgeSet.has(`${e.fromLock}__${e.toLock}`);
          return (
            <path
              key={`e-${i}`}
              d={`M ${x1} ${y1} Q ${midX} ${midY} ${x2} ${y2}`}
              className={"concur-pane__dag-edge" + (isCycle ? " is-cycle" : "")}
              markerEnd={isCycle ? "url(#concur-arrow-danger)" : "url(#concur-arrow)"}
            />
          );
        })}
      </g>

      {/* Nodes */}
      <g>
        {nodes.map((n) => {
          const p = positions.get(n.id);
          if (!p) return null;
          return (
            <g key={n.id} className="concur-pane__dag-node">
              <circle cx={p.x} cy={p.y} r={DAG_NODE_R} />
              <text x={p.x} y={p.y + 3} textAnchor="middle">
                {n.name}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}

export function ConcurrencyPane({ file }: { file: FileFacts }) {
  const map = getConcurrencyMap(file.name);
  const [hoveredAccessId, setHoveredAccessId] = useState<string | null>(null);
  const [selectedRaceKey, setSelectedRaceKey] = useState<string | null>(null);

  const severityCounts = useMemo(() => {
    const c = { high: 0, mid: 0, low: 0 };
    if (!map) return c;
    for (const r of map.races) c[r.severity] += 1;
    return c;
  }, [map]);

  const accessesIdx = useMemo(
    () => (map ? accessById(map.accesses) : new Map<string, Access>()),
    [map],
  );

  if (!map) return <EmptyView fileName={file.name} />;

  const firstCycle = map.deadlockCycles[0];

  return (
    <div className="concur-pane">
      {/* ── Head stats ── */}
      <div className="concur-pane__head">
        <div className="concur-pane__stat">
          <div
            className={
              "concur-pane__stat-v" +
              (severityCounts.high > 0 ? " concur-pane__stat-v--bad" : "")
            }
          >
            {map.races.length}
          </div>
          <div className="concur-pane__stat-k">races</div>
          <div className="concur-pane__pips">
            {severityCounts.high > 0 && (
              <span className={severityPipClass("high")}>{severityCounts.high} high</span>
            )}
            {severityCounts.mid > 0 && (
              <span className={severityPipClass("mid")}>{severityCounts.mid} mid</span>
            )}
            {severityCounts.low > 0 && (
              <span className={severityPipClass("low")}>{severityCounts.low} low</span>
            )}
          </div>
        </div>
        <div className="concur-pane__stat">
          <div
            className={
              "concur-pane__stat-v" +
              (map.deadlockCycles.length > 0 ? " concur-pane__stat-v--bad" : "")
            }
          >
            {map.deadlockCycles.length}
          </div>
          <div className="concur-pane__stat-k">deadlock cycles</div>
        </div>
        <div className="concur-pane__stat">
          <div className="concur-pane__stat-v">
            {map.lanes.length}
            <span className="concur-pane__stat-sep"> × </span>
            {map.resources.length}
          </div>
          <div className="concur-pane__stat-k">lanes × resources</div>
        </div>
      </div>

      {/* ── Body: timeline + DAG inset ── */}
      <div className="concur-pane__body">
        <div className="concur-pane__timeline">
          <Swimlane
            map={map}
            hoveredAccessId={hoveredAccessId}
            selectedRaceKey={selectedRaceKey}
            onHoverAccess={setHoveredAccessId}
          />
          <div className="concur-pane__legend">
            <span className="concur-pane__legend-item">
              <span className="concur-pane__legend-dot is-read" /> read
            </span>
            <span className="concur-pane__legend-item">
              <span className="concur-pane__legend-dot is-write" /> write
            </span>
            <span className="concur-pane__legend-item">
              <span className="concur-pane__legend-arc" /> race
            </span>
          </div>
        </div>

        <aside className="concur-pane__inset">
          <div className="concur-pane__inset-title">Lock-order DAG</div>
          <LockOrderDag map={map} />
          {firstCycle && firstCycle.length > 0 && (
            <div className="concur-pane__alert" role="alert">
              <span className="concur-pane__alert-label">Potential deadlock</span>
              <span className="concur-pane__alert-chain">
                {firstCycle
                  .map((id) => map.locks.find((l) => l.id === id)?.name ?? id)
                  .join(" → ")}
              </span>
            </div>
          )}
        </aside>
      </div>

      {/* ── Race list ── */}
      <ul className="concur-pane__races">
        {map.races.map((r) => {
          const a = accessesIdx.get(r.aId);
          const b = accessesIdx.get(r.bId);
          const resource = map.resources.find((res) => res.id === r.resourceId);
          const key = raceKey(r);
          const isSelected = selectedRaceKey === key;
          return (
            <li
              key={key}
              className={"concur-pane__race-row" + (isSelected ? " is-selected" : "")}
              onClick={() => setSelectedRaceKey(isSelected ? null : key)}
              onKeyDown={(ev) => {
                if (ev.key === "Enter" || ev.key === " ") {
                  ev.preventDefault();
                  setSelectedRaceKey(isSelected ? null : key);
                }
              }}
              role="button"
              tabIndex={0}
            >
              <span className="concur-pane__race-res">
                {resource?.name ?? r.resourceId}
              </span>
              <span className="concur-pane__race-lines">
                <span className="concur-pane__race-line">L{a?.line ?? "?"}</span>
                <span className="concur-pane__race-swap">↔</span>
                <span className="concur-pane__race-line">L{b?.line ?? "?"}</span>
              </span>
              <span className="concur-pane__race-reason">{r.reason}</span>
              <span className={severityPipClass(r.severity)}>{r.severity}</span>
            </li>
          );
        })}
      </ul>

      <div className="concur-pane__foot">
        Happens-before analysis · lock-graph cycles · file:{" "}
        <code className="concur-pane__mono">{file.name}</code>
      </div>
    </div>
  );
}
