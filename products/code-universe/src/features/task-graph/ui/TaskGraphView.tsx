// TaskGraphView — DAG visualization of task dependencies + critical path.
// --------------------------------------------------------------------
// Tasks become nodes; `dependsOn` become directed edges. Nodes are laid
// out left-to-right by topological depth (layer 0 = ready to start).
// Within a layer nodes are evenly spaced vertically.
//
// The critical path — the longest dependency chain by ETA-weight — is
// highlighted in accent color. A cycle detector surfaces any loops we
// would otherwise be unable to topologically order.
//
// Top bar: summary (total / depth / critical-path length / cycles).
// Right panel: list of tasks that are ready to start (no unmet deps).
// Clicking a node selects the first target file of that task.
//
// Reference: CPM (Critical Path Method, Kelley 1961); DAG scheduling;
// bazel build graph.

import { memo, useMemo, useState, type CSSProperties, type ReactElement } from "react";

import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, space, transition } from "../../../shared/ui/tokens";
import {
  synthAgentTasks,
  type AgentTask,
  type AgentTaskPriority,
  type AgentTaskStatus,
} from "../../../shared/analytics/synth-metrics";

interface Props {
  ctx: ViewContextValue;
}

const STATUS_KOREAN: Record<AgentTaskStatus, string> = {
  backlog: "백로그", todo: "대기", "in-progress": "진행 중",
  review: "리뷰", done: "완료", blocked: "블록",
};

const STATUS_TINT: Record<AgentTaskStatus, string> = {
  backlog: color.text3,
  todo: color.text2,
  "in-progress": color.accent,
  review: color.warn,
  done: color.success,
  blocked: color.danger,
};

const PRIORITY_TINT: Record<AgentTaskPriority, string> = {
  critical: color.danger,
  high: color.warn,
  medium: color.accent,
  low: color.text2,
};

const PRIORITY_KOREAN: Record<AgentTaskPriority, string> = {
  critical: "치명", high: "높음", medium: "보통", low: "낮음",
};

const KEYFRAMES = `
@keyframes tg-enter { 0% { opacity: 0; transform: scale(0.98); } 100% { opacity: 1; transform: scale(1); } }
@keyframes tg-item { 0% { opacity: 0; transform: translateY(6px); } 100% { opacity: 1; transform: translateY(0); } }
@keyframes tg-line { 0% { stroke-dashoffset: var(--dash); } 100% { stroke-dashoffset: 0; } }
`;

const NODE_W = 200;
const NODE_H = 60;
const LAYER_GAP = 90;
const ROW_GAP = 24;

interface Placed {
  task: AgentTask;
  layer: number;
  row: number;
  x: number;
  y: number;
}

interface GraphData {
  placed: Map<string, Placed>;
  tasks: AgentTask[];
  validIds: Set<string>;
  layers: AgentTask[][];
  criticalPath: Set<string>;     // task ids in the critical path
  cycles: number;
  readyToStart: AgentTask[];
  width: number;
  height: number;
}

function buildGraph(tasks: AgentTask[]): GraphData {
  const idSet = new Set(tasks.map(t => t.id));
  const byId = new Map(tasks.map(t => [t.id, t]));

  // Valid deps only (dropped orphans).
  const depsOf = new Map<string, string[]>();
  for (const t of tasks) depsOf.set(t.id, t.dependsOn.filter(d => idSet.has(d) && d !== t.id));

  // Kahn's topological sort + cycle detection.
  const indeg = new Map<string, number>();
  for (const id of idSet) indeg.set(id, 0);
  const childrenOf = new Map<string, string[]>();
  for (const id of idSet) childrenOf.set(id, []);
  for (const t of tasks) {
    for (const d of depsOf.get(t.id) ?? []) {
      indeg.set(t.id, (indeg.get(t.id) ?? 0) + 1);
      childrenOf.get(d)!.push(t.id);
    }
  }

  const layer = new Map<string, number>();
  const queue: string[] = [];
  for (const [id, deg] of indeg.entries()) {
    if (deg === 0) { queue.push(id); layer.set(id, 0); }
  }
  let processed = 0;
  while (queue.length > 0) {
    const id = queue.shift()!;
    processed++;
    for (const child of childrenOf.get(id) ?? []) {
      indeg.set(child, (indeg.get(child) ?? 0) - 1);
      const prev = layer.get(child) ?? 0;
      layer.set(child, Math.max(prev, (layer.get(id) ?? 0) + 1));
      if ((indeg.get(child) ?? 0) === 0) queue.push(child);
    }
  }
  const cycles = tasks.length - processed;

  // Cycle-stragglers: pin to max layer + 1.
  const maxClean = [...layer.values()].reduce((m, v) => Math.max(m, v), 0);
  for (const t of tasks) {
    if (!layer.has(t.id)) layer.set(t.id, maxClean + 1);
  }

  const layers: AgentTask[][] = [];
  for (const t of tasks) {
    const lv = layer.get(t.id) ?? 0;
    (layers[lv] ??= []).push(t);
  }
  for (const row of layers) {
    row.sort((a, b) => b.etaMinutes - a.etaMinutes);
  }

  // Placed coords.
  const placed = new Map<string, Placed>();
  let maxRow = 0;
  layers.forEach((row, li) => {
    row.forEach((t, ri) => {
      placed.set(t.id, {
        task: t,
        layer: li,
        row: ri,
        x: li * (NODE_W + LAYER_GAP),
        y: ri * (NODE_H + ROW_GAP),
      });
      if (ri > maxRow) maxRow = ri;
    });
  });

  // Critical path — longest path (by ETA) through DAG.
  const etaOf = new Map<string, number>();
  const prev = new Map<string, string | null>();
  // Process in layer order so DP is valid.
  const sortedIds: string[] = [];
  layers.forEach(row => row.forEach(t => sortedIds.push(t.id)));
  for (const id of sortedIds) {
    const t = byId.get(id)!;
    let best = t.etaMinutes;
    let bestPrev: string | null = null;
    for (const d of depsOf.get(id) ?? []) {
      const cand = (etaOf.get(d) ?? 0) + t.etaMinutes;
      if (cand > best) { best = cand; bestPrev = d; }
    }
    etaOf.set(id, best);
    prev.set(id, bestPrev);
  }
  let endId: string | null = null;
  let endVal = -1;
  for (const [id, v] of etaOf.entries()) {
    if (v > endVal) { endVal = v; endId = id; }
  }
  const critical = new Set<string>();
  let cur: string | null = endId;
  while (cur) {
    critical.add(cur);
    cur = prev.get(cur) ?? null;
  }

  // Ready-to-start: all deps DONE, task itself not done.
  const readyToStart: AgentTask[] = [];
  for (const t of tasks) {
    if (t.status === "done") continue;
    const deps = depsOf.get(t.id) ?? [];
    const ok = deps.every(d => byId.get(d)?.status === "done");
    if (ok) readyToStart.push(t);
  }

  const width = (layers.length > 0 ? layers.length : 1) * (NODE_W + LAYER_GAP);
  const height = (maxRow + 1) * (NODE_H + ROW_GAP);
  return {
    placed, tasks, validIds: idSet, layers,
    criticalPath: critical, cycles, readyToStart,
    width, height,
  };
}

function fmtEta(m: number): string {
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h`;
}

function TaskGraphViewImpl({ ctx }: Props): ReactElement | null {
  const tasks = useMemo<AgentTask[]>(() => synthAgentTasks(ctx.tree), [ctx.tree]);
  const g = useMemo(() => buildGraph(tasks), [tasks]);
  const [hovered, setHovered] = useState<string | null>(null);

  if (tasks.length === 0) {
    return (
      <div style={emptyStyle}>
        <style>{KEYFRAMES}</style>
        <div style={{ color: color.text3, fontSize: font.size.md, fontFamily: font.sans }}>
          에이전트 태스크가 없습니다.
        </div>
      </div>
    );
  }

  const edges: Array<{ from: Placed; to: Placed; critical: boolean }> = [];
  for (const t of tasks) {
    for (const d of t.dependsOn) {
      const from = g.placed.get(d);
      const to = g.placed.get(t.id);
      if (!from || !to) continue;
      const critical = g.criticalPath.has(d) && g.criticalPath.has(t.id);
      edges.push({ from, to, critical });
    }
  }

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>

      <header style={headerStyle}>
        <div>
          <div style={{ fontSize: font.size.lg, fontWeight: font.weight.semibold, color: color.text0 }}>Task Graph</div>
          <div style={{ marginTop: space[1], fontSize: font.size.xs, color: color.text2 }}>
            태스크 의존성 DAG · 위상정렬 × critical path
          </div>
        </div>
      </header>

      <div style={summaryRow}>
        <SummaryStat label="총 태스크" value={tasks.length} tint={color.text0} />
        <SummaryStat label="깊이" value={g.layers.length} tint={color.accent} />
        <SummaryStat label="Critical path" value={g.criticalPath.size} tint={color.warn} />
        <SummaryStat label="사이클 감지" value={g.cycles} tint={g.cycles > 0 ? color.danger : color.success} />
      </div>

      <div style={bodyStyle}>
        <div style={canvasWrap}>
          <svg
            width={Math.max(g.width, 400)}
            height={Math.max(g.height, 240)}
            style={{ display: "block" }}
          >
            <defs>
              <marker id="tg-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill={color.text3} />
              </marker>
              <marker id="tg-arrow-crit" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill={color.accent} />
              </marker>
            </defs>
            {edges.map((e, i) => {
              const x1 = e.from.x + NODE_W;
              const y1 = e.from.y + NODE_H / 2;
              const x2 = e.to.x;
              const y2 = e.to.y + NODE_H / 2;
              const midX = (x1 + x2) / 2;
              const d = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
              return (
                <path
                  key={i}
                  d={d}
                  stroke={e.critical ? color.accent : color.text3}
                  strokeWidth={e.critical ? 2 : 1}
                  fill="none"
                  opacity={e.critical ? 0.9 : 0.55}
                  markerEnd={`url(#${e.critical ? "tg-arrow-crit" : "tg-arrow"})`}
                />
              );
            })}
            {tasks.map((t, i) => {
              const p = g.placed.get(t.id);
              if (!p) return null;
              const crit = g.criticalPath.has(t.id);
              const pTint = PRIORITY_TINT[t.priority];
              const sTint = STATUS_TINT[t.status];
              const h = hovered === t.id;
              return (
                <g
                  key={t.id}
                  transform={`translate(${p.x},${p.y})`}
                  style={{
                    cursor: "pointer",
                    animation: `tg-item 440ms cubic-bezier(0.22, 1, 0.28, 1) both`,
                    animationDelay: `${Math.min(i, 30) * 22}ms`,
                  }}
                  onClick={() => {
                    const f = t.targetFileIds[0];
                    if (f) ctx.dispatch.selectEntity(f);
                  }}
                  onMouseEnter={() => setHovered(t.id)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <rect
                    width={NODE_W}
                    height={NODE_H}
                    rx={6}
                    ry={6}
                    fill={color.bg1}
                    stroke={crit ? color.accent : h ? color.borderStrong : color.border}
                    strokeWidth={crit ? 2 : 1}
                  />
                  <circle cx={10} cy={10} r={4} fill={pTint} />
                  <text x={22} y={14} fontSize={10} fontFamily={font.mono} fill={color.text3}>
                    L{p.layer}
                  </text>
                  <text
                    x={10}
                    y={34}
                    fontSize={12}
                    fontFamily={font.sans}
                    fontWeight={600}
                    fill={color.text0}
                  >
                    {t.title.length > 26 ? t.title.slice(0, 25) + "…" : t.title}
                  </text>
                  <rect x={10} y={44} width={60} height={12} rx={3} ry={3} fill={`${sTint}22`} stroke={sTint} strokeWidth={0.5} />
                  <text x={40} y={53} fontSize={9} fontFamily={font.sans} fill={sTint} textAnchor="middle" fontWeight={600}>
                    {STATUS_KOREAN[t.status]}
                  </text>
                  <text x={NODE_W - 10} y={53} fontSize={10} fontFamily={font.mono} fill={color.text2} textAnchor="end">
                    {fmtEta(t.etaMinutes)}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <div style={rightPanel}>
          <div style={panelStyle}>
            <div style={labelStyle}>Ready to start</div>
            {g.readyToStart.length === 0 ? (
              <div style={{ marginTop: space[2], color: color.text3, fontSize: font.size.xs }}>
                시작 가능한 태스크가 없습니다.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", marginTop: space[2] }}>
                {g.readyToStart.slice(0, 12).map((t, i) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      const f = t.targetFileIds[0];
                      if (f) ctx.dispatch.selectEntity(f);
                    }}
                    style={{
                      ...readyRow,
                      animationDelay: `${i * 20}ms`,
                    }}
                  >
                    <span style={{
                      width: 6, height: 6, borderRadius: "50%",
                      background: PRIORITY_TINT[t.priority],
                      flexShrink: 0,
                    }} />
                    <span style={{
                      fontSize: font.size.sm,
                      color: color.text0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      flex: 1,
                    }}>
                      {t.title}
                    </span>
                    <span style={{ fontSize: font.size.xxs, fontFamily: font.mono, color: color.text3 }}>
                      {PRIORITY_KOREAN[t.priority]}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ ...panelStyle, animationDelay: "40ms" }}>
            <div style={labelStyle}>Legend</div>
            <div style={{ marginTop: space[2], display: "flex", flexDirection: "column", gap: space[1] }}>
              <LegendRow color={color.accent} label="Critical path (최장 chain)" />
              <LegendRow color={color.text3} label="일반 dependency" />
              <LegendRow color={color.danger} label="사이클 감지" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryStat({ label, value, tint }: { label: string; value: number; tint: string }): ReactElement {
  return (
    <div style={statTile}>
      <span style={{ fontSize: font.size.xxs, color: color.text2, letterSpacing: font.letter.ultra, textTransform: "uppercase", fontWeight: font.weight.semibold }}>
        {label}
      </span>
      <span style={{
        fontFamily: font.mono,
        fontSize: 24,
        fontWeight: font.weight.bold,
        color: tint,
        fontVariantNumeric: "tabular-nums",
        lineHeight: 1,
        marginTop: 2,
      }}>
        {value}
      </span>
    </div>
  );
}

function LegendRow({ color: c, label }: { color: string; label: string }): ReactElement {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: space[2] }}>
      <span style={{ width: 16, height: 2, background: c, borderRadius: 1 }} />
      <span style={{ fontSize: font.size.xs, color: color.text1 }}>{label}</span>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────

const rootStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  padding: `${space[6]}px ${space[7]}px`,
  background: color.bg0,
  boxSizing: "border-box",
  overflow: "auto",
  animation: "tg-enter 520ms cubic-bezier(0.22, 1, 0.28, 1) both",
  fontFamily: font.sans,
};

const headerStyle: CSSProperties = {
  marginBottom: space[3],
};

const summaryRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: space[3],
  marginBottom: space[4],
};

const statTile: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  padding: `${space[3]}px ${space[4]}px`,
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  animation: "tg-item 440ms cubic-bezier(0.22, 1, 0.28, 1) both",
};

const bodyStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 280px",
  gap: space[3],
  alignItems: "start",
};

const canvasWrap: CSSProperties = {
  padding: space[4],
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  overflow: "auto",
  minHeight: 320,
};

const rightPanel: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: space[3],
};

const panelStyle: CSSProperties = {
  padding: space[4],
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  animation: "tg-item 440ms cubic-bezier(0.22, 1, 0.28, 1) both",
};

const labelStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  fontWeight: font.weight.semibold,
};

const readyRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[2],
  padding: `${space[2]}px ${space[2]}px`,
  borderTop: `1px solid ${color.border}`,
  background: "transparent",
  border: "none",
  borderBottom: "none",
  borderLeft: "none",
  borderRight: "none",
  cursor: "pointer",
  textAlign: "left",
  font: "inherit",
  transition: `background ${transition.base}`,
  animation: "tg-item 440ms cubic-bezier(0.22, 1, 0.28, 1) both",
};

const emptyStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: color.bg0,
};

export const TaskGraphView = memo(TaskGraphViewImpl);
