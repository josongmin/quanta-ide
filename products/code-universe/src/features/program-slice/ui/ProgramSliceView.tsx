// ProgramSliceView — dual-mode backward/forward slice.
// --------------------------------------------------------------------
// Selected entity at center. BFS up to 3 hops over `graph.fileEdges`:
//   backward slice = follow edges where `to == current` (producers).
//   forward slice  = follow edges where `from == current` (consumers).
// Nodes radiate on concentric rings by hop distance; deeper hops fade
// heavily so the eye lands on the immediate blast zone first.
//
// Reference: Weiser, "Program Slicing", IEEE TSE 1981. CodeSurfer.

import { memo, useEffect, useMemo, useState, type CSSProperties, type ReactElement } from "react";
import type { EntityKind, WorkspaceGraph } from "@quanta/canvas-engine";
import type { EntityTree } from "../../../entities/entity";
import { color, font, kindColor, radius, space } from "../../../shared/ui/tokens";
import { hashId } from "../../../shared/analytics/synth-metrics";

interface Props {
  graph: WorkspaceGraph;
  tree: EntityTree | null;
  selectedId: string | null;
  width: number;
  height: number;
  onFocusEntity?: (id: string) => void;
}

type SliceMode = "backward" | "forward";

interface RingNode {
  id: string;
  label: string;
  kind: EntityKind;
  hop: number;
  x: number;
  y: number;
}

interface RingEdge {
  id: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  hop: number;
}

const MAX_HOPS = 3;
const MAX_PER_RING = 16;

const KEYFRAMES = `
@keyframes ps-enter {
  0%   { opacity: 0; transform: scale(0.96); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes ps-draw {
  0%   { stroke-dashoffset: var(--dash); }
  100% { stroke-dashoffset: 0; }
}
@keyframes ps-center-pulse {
  0%, 100% { stroke-opacity: 0.55; }
  50%       { stroke-opacity: 0.9; }
}
`;

function resolveLabel(id: string, tree: EntityTree | null): { label: string; kind: EntityKind } {
  if (tree) {
    const e = tree.byId.get(id);
    if (e) return { label: e.name, kind: e.kind };
  }
  const seg = id.split(/[\/:]/).pop() ?? id;
  return { label: seg, kind: "building" };
}

function bfsSlice(
  edges: ReadonlyArray<{ from: string; to: string }>,
  start: string,
  mode: SliceMode,
  maxHops: number,
): Map<string, number> {
  // Adjacency lookup dictated by mode.
  const byKey = new Map<string, string[]>();
  for (const e of edges) {
    const key = mode === "backward" ? e.to : e.from;
    const value = mode === "backward" ? e.from : e.to;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(value);
  }
  const visited = new Map<string, number>();
  visited.set(start, 0);
  let frontier: string[] = [start];
  for (let hop = 1; hop <= maxHops; hop++) {
    const next: string[] = [];
    for (const cur of frontier) {
      for (const nb of byKey.get(cur) ?? []) {
        if (visited.has(nb)) continue;
        visited.set(nb, hop);
        next.push(nb);
      }
    }
    frontier = next;
    if (frontier.length === 0) break;
  }
  return visited;
}

function layoutRings(
  hops: Map<string, number>,
  centerId: string,
  tree: EntityTree | null,
  width: number,
  height: number,
): { nodes: RingNode[]; edges: RingEdge[]; byId: Map<string, RingNode> } {
  const cx = width / 2;
  const cy = height / 2;
  const ringR = [0, 130, 240, 340];
  const byHop = new Map<number, string[]>();
  for (const [id, hop] of hops) {
    if (!byHop.has(hop)) byHop.set(hop, []);
    byHop.get(hop)!.push(id);
  }
  // Sort deterministically by id-hash, then cap per-ring so outer rings stay clean
  for (const [hop, ids] of byHop) {
    ids.sort((a, b) => hashId(a) - hashId(b));
    if (hop > 0 && ids.length > MAX_PER_RING) ids.length = MAX_PER_RING;
  }

  const nodes: RingNode[] = [];
  const byId = new Map<string, RingNode>();
  for (const [hop, ids] of byHop) {
    const r = ringR[hop] ?? 340 + (hop - 3) * 60;
    if (hop === 0) {
      const { label, kind } = resolveLabel(ids[0]!, tree);
      const node: RingNode = { id: ids[0]!, label, kind, hop: 0, x: cx, y: cy };
      nodes.push(node);
      byId.set(node.id, node);
      continue;
    }
    const angleStep = (Math.PI * 2) / Math.max(1, ids.length);
    // Angular offset seeded by the center's hash so re-selecting gives a
    // different but reproducible angular layout per anchor.
    const offset = (hashId(centerId + ":" + hop) % 360) * (Math.PI / 180);
    ids.forEach((id, i) => {
      const theta = offset + i * angleStep;
      const { label, kind } = resolveLabel(id, tree);
      const node: RingNode = {
        id, label, kind, hop,
        x: cx + Math.cos(theta) * r,
        y: cy + Math.sin(theta) * r,
      };
      nodes.push(node);
      byId.set(id, node);
    });
  }

  // Edges connect each node to the closest lower-hop ancestor by straight
  // line — purely visual. For a faithful slice we'd need to remember the
  // spanning tree from BFS; visually the radial line reads the same.
  const edges: RingEdge[] = [];
  for (const n of nodes) {
    if (n.hop === 0) continue;
    // Find any lower-hop node (rough spanning-tree proxy: the one with the
    // closest angular position in the inner ring).
    const inner = nodes.filter(m => m.hop === n.hop - 1);
    if (inner.length === 0) continue;
    let best = inner[0]!;
    let bestD = Infinity;
    for (const m of inner) {
      const dx = m.x - n.x;
      const dy = m.y - n.y;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = m; }
    }
    edges.push({
      id: `e-${best.id}->${n.id}`,
      from: { x: best.x, y: best.y },
      to: { x: n.x, y: n.y },
      hop: n.hop,
    });
  }

  return { nodes, edges, byId };
}

function ProgramSliceViewImpl({
  graph,
  tree,
  selectedId,
  width,
  height,
  onFocusEntity,
}: Props): ReactElement {
  const [mode, setMode] = useState<SliceMode>("backward");

  useEffect(() => {
    const s = document.createElement("style");
    s.textContent = KEYFRAMES;
    s.dataset.programSliceKeyframes = "1";
    document.head.appendChild(s);
    return () => { s.remove(); };
  }, []);

  const vbW = Math.max(800, width);
  const vbH = Math.max(560, height);

  const sliceData = useMemo(() => {
    if (!selectedId) return null;
    const edges = graph.fileEdges.filter(e => e.from && e.to);
    const hops = bfsSlice(edges, selectedId, mode, MAX_HOPS);
    return layoutRings(hops, selectedId, tree, vbW, vbH - 60);
  }, [graph.fileEdges, selectedId, mode, tree, vbW, vbH]);

  if (!selectedId) {
    return (
      <div style={emptyStyle}>
        <div style={{ fontSize: font.size.md, color: color.text3 }}>
          영향 분석할 파일을 선택하세요.
        </div>
      </div>
    );
  }

  if (!sliceData || sliceData.nodes.length === 0) {
    return (
      <div style={rootStyle}>
        <Header mode={mode} setMode={setMode} centerId={selectedId} tree={tree} reach={0} />
        <div style={emptyInner}>
          <div style={{ fontSize: font.size.sm, color: color.text3 }}>
            연결된 파일이 없습니다.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={rootStyle}>
      <Header mode={mode} setMode={setMode} centerId={selectedId} tree={tree} reach={sliceData.nodes.length - 1} />

      <div style={canvasWrapStyle}>
        <svg viewBox={`0 0 ${vbW} ${vbH}`} preserveAspectRatio="xMidYMid meet" style={svgStyle}>
          <defs>
            <marker id="ps-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" fill={mode === "backward" ? color.success : color.accent} opacity={0.7} />
            </marker>
          </defs>

          {/* Ring guides */}
          {[130, 240, 340].map((r, i) => (
            <circle
              key={r}
              cx={vbW / 2} cy={(vbH - 60) / 2 + 0}
              r={r}
              fill="none"
              stroke={color.border}
              strokeDasharray="2 6"
              strokeOpacity={0.7 - i * 0.18}
            />
          ))}

          {/* Edges */}
          {sliceData.edges.map((e, i) => {
            const alpha = Math.max(0.12, 0.8 - e.hop * 0.22);
            const dash = 260;
            const tint = mode === "backward" ? color.success : color.accent;
            return (
              <line
                key={e.id}
                x1={e.from.x} y1={e.from.y}
                x2={e.to.x} y2={e.to.y}
                stroke={tint}
                strokeOpacity={alpha}
                strokeWidth={1.1}
                markerEnd="url(#ps-arrow)"
                strokeDasharray={`${dash}`}
                style={{
                  ["--dash" as string]: dash.toString(),
                  animation: `ps-draw 560ms cubic-bezier(0.22, 1, 0.28, 1) both`,
                  animationDelay: `${120 + i * 18}ms`,
                }}
              />
            );
          })}

          {/* Nodes */}
          {sliceData.nodes.map((n, i) => {
            const isCenter = n.hop === 0;
            const fadeByHop = isCenter ? 1 : Math.max(0.35, 1 - n.hop * 0.25);
            const tint = kindColor[n.kind] ?? color.text1;
            const r = isCenter ? 14 : Math.max(6, 10 - n.hop);
            return (
              <g
                key={n.id}
                style={{
                  cursor: "pointer",
                  opacity: fadeByHop,
                  animation: `ps-enter 520ms cubic-bezier(0.22, 1, 0.28, 1) both`,
                  animationDelay: `${40 + i * 16}ms`,
                  transition: "opacity 180ms ease-out",
                }}
                onClick={() => onFocusEntity?.(n.id)}
              >
                <circle
                  cx={n.x} cy={n.y} r={r}
                  fill={isCenter ? color.accentSofter : tint}
                  fillOpacity={isCenter ? 1 : 0.16}
                  stroke={isCenter ? color.accent : tint}
                  strokeWidth={isCenter ? 1.8 : 1.2}
                  style={isCenter ? { animation: `ps-center-pulse 2.2s ease-in-out infinite` } : undefined}
                />
                {!isCenter && (
                  <circle
                    cx={n.x} cy={n.y} r={Math.max(2, r * 0.38)}
                    fill={tint}
                    fillOpacity={0.9}
                  />
                )}
                <text
                  x={n.x + r + 5}
                  y={n.y + 3}
                  fontFamily={font.sans}
                  fontSize={isCenter ? 11 : 10}
                  fontWeight={isCenter ? font.weight.semibold : font.weight.regular}
                  fill={isCenter ? color.text0 : color.text1}
                  style={{ userSelect: "none" }}
                >
                  {n.label.length > 22 ? n.label.slice(0, 20) + "…" : n.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function Header({
  mode, setMode, centerId, tree, reach,
}: {
  mode: SliceMode;
  setMode: (m: SliceMode) => void;
  centerId: string;
  tree: EntityTree | null;
  reach: number;
}) {
  const entity = tree?.byId.get(centerId);
  const name = entity?.name ?? centerId.split(/[\/:]/).pop() ?? centerId;
  return (
    <header style={headerStyle}>
      <div>
        <div style={{ fontSize: font.size.lg, fontWeight: font.weight.semibold, color: color.text0 }}>
          Program Slice · <span style={{ fontFamily: font.mono, color: color.text1 }}>{name}</span>
        </div>
        <div style={{ marginTop: space[1], fontSize: font.size.xs, color: color.text2 }}>
          {mode === "backward" ? "이 파일에 영향을 주는" : "이 파일이 영향을 주는"} 파일 {reach}개 · 최대 {MAX_HOPS}-hop
        </div>
      </div>

      <div style={toggleWrap}>
        {(["backward", "forward"] as const).map(m => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            style={{
              ...toggleBtn,
              background: mode === m ? color.selected : color.bg1,
              color: mode === m ? color.text0 : color.text2,
              fontWeight: mode === m ? font.weight.semibold : font.weight.regular,
            }}
          >
            {m === "backward" ? "← Backward" : "Forward →"}
          </button>
        ))}
      </div>
    </header>
  );
}

const rootStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  padding: `${space[6]}px ${space[7]}px`,
  background: color.bg0,
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  animation: "ps-enter 520ms cubic-bezier(0.22, 1, 0.28, 1) both",
};

const headerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  marginBottom: space[4],
  gap: space[4],
};

const toggleWrap: CSSProperties = {
  display: "inline-flex",
  background: color.bg2,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  padding: 2,
  gap: 2,
};

const toggleBtn: CSSProperties = {
  border: "none",
  padding: `6px 12px`,
  borderRadius: radius.sm,
  cursor: "pointer",
  fontFamily: font.sans,
  fontSize: font.size.xs,
  letterSpacing: "0.02em",
  transition: "background 180ms ease-out",
};

const canvasWrapStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflow: "hidden",
  borderRadius: radius.md,
};

const svgStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "block",
};

const emptyStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: color.bg0,
  padding: space[7],
};

const emptyInner: CSSProperties = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

export const ProgramSliceView = memo(ProgramSliceViewImpl);
