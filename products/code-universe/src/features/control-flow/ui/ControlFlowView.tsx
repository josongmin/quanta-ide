// ControlFlowView — per-function basic-block CFG.
// --------------------------------------------------------------------
// Given a selected entity, renders its synthesized control-flow graph:
//   entry    → green rounded rect
//   stmt     → white rounded rect
//   branch   → amber diamond
//   loop     → back-edge dashed curve
//   exit     → red rounded rect
// Layout is a depth-first tree walk — each node gets a (depth, order)
// coordinate. Edges are straight arrows; back-edges draw as dashed
// curves so the cycle reads without crossing the main trunk.
//
// Reference: Allen, "Control Flow Analysis", CACM 1970.

import { memo, useEffect, useMemo, type CSSProperties, type ReactElement } from "react";
import type { EntityTree } from "../../../entities/entity";
import { color, font, radius, space } from "../../../shared/ui/tokens";
import { synthCfg, type SynthCfgNode } from "../../../shared/analytics/synth-metrics";

interface Props {
  tree: EntityTree | null;
  selectedId: string | null;
  width: number;
  height: number;
}

interface LaidNode {
  id: string;
  kind: SynthCfgNode["kind"];
  label: string;
  x: number;
  y: number;
}

interface LaidEdge {
  id: string;
  from: LaidNode;
  to: LaidNode;
  backEdge: boolean;
}

const KEYFRAMES = `
@keyframes cfg-enter {
  0%   { opacity: 0; transform: scale(0.96); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes cfg-draw {
  0%   { stroke-dashoffset: var(--dash); }
  100% { stroke-dashoffset: 0; }
}
`;

function layoutCfg(
  nodes: SynthCfgNode[],
  width: number,
  height: number,
): { nodes: LaidNode[]; edges: LaidEdge[] } {
  if (nodes.length === 0) return { nodes: [], edges: [] };
  const byId = new Map(nodes.map(n => [n.id, n]));

  // Compute depth via DFS — depth 0 at entry.
  const depth = new Map<string, number>();
  const order = new Map<string, number>();
  let orderCounter = 0;
  function dfs(id: string, d: number) {
    if (depth.has(id)) {
      if ((depth.get(id) ?? 0) > d) depth.set(id, d);
      return;
    }
    depth.set(id, d);
    order.set(id, orderCounter++);
    const n = byId.get(id);
    if (!n) return;
    for (const c of n.children) {
      // Avoid infinite recursion on loop back-edges.
      if (!depth.has(c)) dfs(c, d + 1);
    }
  }
  dfs(nodes[0]!.id, 0);
  // Any orphan nodes → pick up trailing depths.
  for (const n of nodes) if (!depth.has(n.id)) { depth.set(n.id, 0); order.set(n.id, orderCounter++); }

  // Group by depth for vertical packing.
  const byDepth = new Map<number, string[]>();
  for (const id of depth.keys()) {
    const d = depth.get(id)!;
    if (!byDepth.has(d)) byDepth.set(d, []);
    byDepth.get(d)!.push(id);
  }
  for (const ids of byDepth.values()) {
    ids.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
  }

  const depths = [...byDepth.keys()].sort((a, b) => a - b);
  const padY = 64;
  const padX = 80;
  const usableH = Math.max(360, height - padY * 2);
  const usableW = Math.max(360, width - padX * 2);
  const rowStep = depths.length > 1 ? usableH / (depths.length - 1) : 0;

  const laid: LaidNode[] = [];
  const posById = new Map<string, LaidNode>();
  for (let i = 0; i < depths.length; i++) {
    const d = depths[i]!;
    const ids = byDepth.get(d)!;
    const colStep = ids.length > 1 ? usableW / (ids.length - 1) : 0;
    const colOffset = ids.length === 1 ? usableW / 2 : 0;
    ids.forEach((id, j) => {
      const src = byId.get(id)!;
      const x = padX + colOffset + (ids.length > 1 ? j * colStep : 0);
      const y = padY + i * rowStep;
      const node: LaidNode = { id, kind: src.kind, label: src.label, x, y };
      laid.push(node);
      posById.set(id, node);
    });
  }

  const edges: LaidEdge[] = [];
  for (const src of nodes) {
    const from = posById.get(src.id);
    if (!from) continue;
    for (const childId of src.children) {
      const to = posById.get(childId);
      if (!to) continue;
      // Back-edge: target is at or above the source's depth AND the node
      // is not a trivial self-loop point (we still treat self-edges as
      // back-edges so a loop node gets the dashed-curve treatment).
      const dSrc = depth.get(src.id) ?? 0;
      const dDst = depth.get(childId) ?? 0;
      const backEdge = dDst <= dSrc;
      edges.push({
        id: `${src.id}->${childId}`,
        from, to,
        backEdge,
      });
    }
  }

  return { nodes: laid, edges };
}

/** Parse a "#rrggbb" token hex into a "rgba(r,g,b,a)" string so fill
 *  washes stay in lock-step with the semantic token set. */
function tint(hex: string, alpha: number): string {
  const h = hex.replace(/^#/, "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function kindFill(k: SynthCfgNode["kind"]): string {
  switch (k) {
    case "entry": return tint(color.success, 0.10);
    case "exit":  return tint(color.danger, 0.10);
    case "branch":return tint(color.warn, 0.10);
    case "loop":  return tint(color.accent, 0.10);
    default:      return color.bg1;
  }
}

function kindStroke(k: SynthCfgNode["kind"]): string {
  switch (k) {
    case "entry": return color.success;
    case "exit":  return color.danger;
    case "branch":return color.warn;
    case "loop":  return color.accent;
    default:      return color.borderStrong;
  }
}

function ControlFlowViewImpl({ tree, selectedId, width, height }: Props): ReactElement {
  useEffect(() => {
    const s = document.createElement("style");
    s.textContent = KEYFRAMES;
    s.dataset.cfgKeyframes = "1";
    document.head.appendChild(s);
    return () => { s.remove(); };
  }, []);

  // Resolve target entity: a selected building/floor/room is the anchor.
  // If selection is something else (or null), show hint.
  const anchor = useMemo(() => {
    if (!selectedId) return null;
    if (!tree) {
      // Still allow synth preview using the raw id as seed.
      return { id: selectedId, name: selectedId.split(/[\/:]/).pop() ?? selectedId, kind: "building" as const };
    }
    const e = tree.byId.get(selectedId);
    if (!e) return null;
    if (e.kind !== "building" && e.kind !== "floor" && e.kind !== "room") return null;
    return { id: e.id, name: e.name, kind: e.kind };
  }, [selectedId, tree]);

  const cfgNodes = useMemo(() => anchor ? synthCfg(anchor.id) : [], [anchor]);
  const vbW = Math.max(800, width);
  const vbH = Math.max(560, height);
  const laid = useMemo(
    () => layoutCfg(cfgNodes, vbW - 80, vbH - 140),
    [cfgNodes, vbW, vbH],
  );

  if (!anchor) {
    return (
      <div style={emptyStyle}>
        <div style={{ fontSize: font.size.md, color: color.text3 }}>
          파일 또는 함수를 선택하세요.
        </div>
      </div>
    );
  }

  return (
    <div style={rootStyle}>
      <header style={headerStyle}>
        <div>
          <div style={{ fontSize: font.size.lg, fontWeight: font.weight.semibold, color: color.text0 }}>
            Control Flow · <span style={{ fontFamily: font.mono, color: color.text1 }}>{anchor.name}</span>
          </div>
          <div style={{ marginTop: space[1], fontSize: font.size.xs, color: color.text2 }}>
            basic-block 그래프 · {laid.nodes.length} 블록 · {laid.edges.length} 엣지
          </div>
        </div>
        <Legend />
      </header>

      <div style={canvasWrapStyle}>
        <svg viewBox={`0 0 ${vbW} ${vbH}`} preserveAspectRatio="xMidYMid meet" style={svgStyle}>
          <defs>
            <marker id="cfg-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" fill={color.text2} />
            </marker>
            <marker id="cfg-arrow-back" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" fill={color.accent} />
            </marker>
          </defs>

          {/* Edges first — under nodes */}
          {laid.edges.map((e, i) => {
            const midX = (e.from.x + e.to.x) / 2;
            const midY = (e.from.y + e.to.y) / 2;
            const dx = e.to.x - e.from.x;
            const path = e.backEdge
              ? `M ${e.from.x} ${e.from.y} C ${e.from.x + 90} ${e.from.y + 20}, ${e.to.x + 90} ${e.to.y - 20}, ${e.to.x} ${e.to.y}`
              : `M ${e.from.x} ${e.from.y} Q ${midX + Math.sign(dx) * 10} ${midY} ${e.to.x} ${e.to.y}`;
            const dash = 260;
            return (
              <path
                key={e.id}
                d={path}
                fill="none"
                stroke={e.backEdge ? color.accent : color.text2}
                strokeWidth={e.backEdge ? 1.2 : 1}
                strokeOpacity={e.backEdge ? 0.7 : 0.5}
                strokeDasharray={e.backEdge ? "5 4" : `${dash}`}
                markerEnd={e.backEdge ? "url(#cfg-arrow-back)" : "url(#cfg-arrow)"}
                style={!e.backEdge ? {
                  ["--dash" as string]: dash.toString(),
                  animation: `cfg-draw 560ms cubic-bezier(0.22, 1, 0.28, 1) both`,
                  animationDelay: `${120 + i * 16}ms`,
                } : undefined}
              />
            );
          })}

          {/* Nodes */}
          {laid.nodes.map((n, i) => {
            const isBranch = n.kind === "branch";
            const fill = kindFill(n.kind);
            const stroke = kindStroke(n.kind);
            const w = 110;
            const h = 36;
            const label = n.label.length > 14 ? n.label.slice(0, 12) + "…" : n.label;
            return (
              <g
                key={n.id}
                style={{
                  animation: `cfg-enter 520ms cubic-bezier(0.22, 1, 0.28, 1) both`,
                  animationDelay: `${40 + i * 18}ms`,
                }}
              >
                {isBranch ? (
                  <polygon
                    points={`${n.x},${n.y - h / 2} ${n.x + w / 2},${n.y} ${n.x},${n.y + h / 2} ${n.x - w / 2},${n.y}`}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={1.2}
                  />
                ) : (
                  <rect
                    x={n.x - w / 2} y={n.y - h / 2}
                    width={w} height={h}
                    rx={radius.md} ry={radius.md}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={1.2}
                  />
                )}
                <text
                  x={n.x} y={n.y - 2}
                  fontFamily={font.mono}
                  fontSize={11}
                  fill={color.text0}
                  textAnchor="middle"
                >
                  {label}
                </text>
                <text
                  x={n.x} y={n.y + 11}
                  fontFamily={font.sans}
                  fontSize={8.5}
                  fill={color.text3}
                  textAnchor="middle"
                  letterSpacing="0.08em"
                >
                  {n.kind.toUpperCase()}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function Legend() {
  const items: Array<{ k: SynthCfgNode["kind"]; label: string }> = [
    { k: "entry", label: "entry" },
    { k: "stmt", label: "stmt" },
    { k: "branch", label: "branch" },
    { k: "loop", label: "loop" },
    { k: "exit", label: "exit" },
  ];
  return (
    <div style={{ display: "flex", gap: space[3], fontSize: font.size.xxs, color: color.text2 }}>
      {items.map(i => (
        <span key={i.k} style={legendItem}>
          <span style={{
            display: "inline-block",
            width: 10, height: 10,
            borderRadius: i.k === "branch" ? 0 : radius.sm,
            transform: i.k === "branch" ? "rotate(45deg)" : undefined,
            background: kindFill(i.k),
            border: `1px solid ${kindStroke(i.k)}`,
          }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

const legendItem: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: space[1],
};

const rootStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  padding: `${space[6]}px ${space[7]}px`,
  background: color.bg0,
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  animation: "cfg-enter 520ms cubic-bezier(0.22, 1, 0.28, 1) both",
};

const headerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  marginBottom: space[4],
  gap: space[4],
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

export const ControlFlowView = memo(ControlFlowViewImpl);
