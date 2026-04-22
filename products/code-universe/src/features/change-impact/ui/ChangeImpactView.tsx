// ChangeImpactView — concentric rings of transitive dependents.
// --------------------------------------------------------------------
// Forward BFS over `graph.fileEdges` from the selected entity. Ring 1 =
// direct dependents, Ring 2 = indirect, Ring 3+ = deeper. Each ring's
// angular layout is deterministic (hashId(id) % 360). Right-side panel
// exports a 1hop/2hop/3hop+ list with counts so the user can eyeball the
// closure size before reaching for the refactor.
//
// Reference: Bohner & Arnold, "Software Change Impact Analysis",
// IEEE CS Press 1996.

import { memo, useEffect, useMemo, type CSSProperties, type ReactElement } from "react";
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

interface ImpactNode {
  id: string;
  label: string;
  kind: EntityKind;
  hop: number;
  x: number;
  y: number;
}

const MAX_HOPS = 6;
const RING_STEP = 120;
const RINGS_RENDERED = 3;

const KEYFRAMES = `
@keyframes ci-enter {
  0%   { opacity: 0; transform: scale(0.96); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes ci-draw {
  0%   { stroke-dashoffset: var(--dash); }
  100% { stroke-dashoffset: 0; }
}
@keyframes ci-ring-pulse {
  0%, 100% { stroke-opacity: 0.35; }
  50%       { stroke-opacity: 0.55; }
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

/** Forward BFS — who depends on `start` transitively. */
function forwardClosure(
  edges: ReadonlyArray<{ from: string; to: string }>,
  start: string,
  maxHops: number,
): Map<string, number> {
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    if (!adj.has(e.from)) adj.set(e.from, []);
    adj.get(e.from)!.push(e.to);
  }
  const visited = new Map<string, number>();
  visited.set(start, 0);
  let frontier: string[] = [start];
  for (let hop = 1; hop <= maxHops; hop++) {
    const next: string[] = [];
    for (const cur of frontier) {
      for (const nb of adj.get(cur) ?? []) {
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

function ChangeImpactViewImpl({
  graph,
  tree,
  selectedId,
  width,
  height,
  onFocusEntity,
}: Props): ReactElement {
  useEffect(() => {
    const s = document.createElement("style");
    s.textContent = KEYFRAMES;
    s.dataset.changeImpactKeyframes = "1";
    document.head.appendChild(s);
    return () => { s.remove(); };
  }, []);

  const vbW = Math.max(800, width);
  const vbH = Math.max(560, height);

  // Reserve the right ~260px for the breakdown panel.
  const panelW = 260;
  const diagramW = vbW - panelW - space[4];
  const cx = diagramW / 2;
  const cy = vbH / 2;

  const data = useMemo(() => {
    if (!selectedId) return null;
    const closure = forwardClosure(graph.fileEdges.filter(e => e.from && e.to), selectedId, MAX_HOPS);

    // Group by hop for breakdown
    const byHop = new Map<number, string[]>();
    for (const [id, hop] of closure) {
      if (!byHop.has(hop)) byHop.set(hop, []);
      byHop.get(hop)!.push(id);
    }

    // Lay out rings
    const nodes: ImpactNode[] = [];
    for (const [hop, ids] of byHop) {
      if (hop === 0) {
        const { label, kind } = resolveLabel(ids[0]!, tree);
        nodes.push({ id: ids[0]!, label, kind, hop: 0, x: cx, y: cy });
        continue;
      }
      if (hop > RINGS_RENDERED) continue;
      const r = hop * RING_STEP;
      // Sort by hashId for determinism, cap per ring so outer rings stay readable
      const maxPerRing = 10 + hop * 4;
      const capped = ids.slice().sort((a, b) => hashId(a) - hashId(b)).slice(0, maxPerRing);
      capped.forEach(id => {
        const theta = ((hashId(id) % 360) * Math.PI) / 180;
        const { label, kind } = resolveLabel(id, tree);
        nodes.push({
          id, label, kind, hop,
          x: cx + Math.cos(theta) * r,
          y: cy + Math.sin(theta) * r,
        });
      });
    }

    const one = byHop.get(1)?.length ?? 0;
    const two = byHop.get(2)?.length ?? 0;
    let threePlus = 0;
    for (const [hop, ids] of byHop) if (hop >= 3) threePlus += ids.length;
    const total = closure.size - 1;

    return { nodes, byHop, one, two, threePlus, total };
  }, [graph.fileEdges, selectedId, tree, cx, cy]);

  if (!selectedId) {
    return (
      <div style={emptyStyle}>
        <div style={{ fontSize: font.size.md, color: color.text3 }}>
          영향 범위를 계산할 파일을 선택하세요.
        </div>
      </div>
    );
  }

  if (!data) return <div style={emptyStyle} />;

  const centerEntity = tree?.byId.get(selectedId);
  const centerName = centerEntity?.name ?? selectedId.split(/[\/:]/).pop() ?? selectedId;

  return (
    <div style={rootStyle}>
      <header style={headerStyle}>
        <div>
          <div style={{ fontSize: font.size.lg, fontWeight: font.weight.semibold, color: color.text0 }}>
            Change Impact · <span style={{ fontFamily: font.mono, color: color.text1 }}>{centerName}</span>
          </div>
          <div style={{ marginTop: space[1], fontSize: font.size.xs, color: color.text2 }}>
            변경 시 영향받는 파일 <strong style={{ color: color.accent }}>{data.total}</strong>개 (최대 {MAX_HOPS}-hop)
          </div>
        </div>
      </header>

      <div style={bodyStyle}>
        <div style={{ ...canvasWrapStyle, width: diagramW }}>
          <svg
            viewBox={`0 0 ${diagramW} ${vbH}`}
            preserveAspectRatio="xMidYMid meet"
            style={svgStyle}
          >
            {/* Ring guides */}
            {[1, 2, 3].map(i => (
              <circle
                key={i}
                cx={cx} cy={cy} r={i * RING_STEP}
                fill="none"
                stroke={color.border}
                strokeDasharray="2 6"
                strokeOpacity={0.45 - (i - 1) * 0.12}
                style={{ animation: `ci-ring-pulse 3s ease-in-out infinite` }}
              />
            ))}

            {/* Edges: center → hop1 thin, hop1 → hop2 thinner, etc. */}
            {data.nodes.filter(n => n.hop >= 1 && n.hop <= RINGS_RENDERED).map((n, i) => {
              // Connect each hop-K node back to the center for hop 1;
              // for hop K>1, connect to the closest hop K-1 node (proxy path).
              let parent: { x: number; y: number };
              if (n.hop === 1) {
                parent = { x: cx, y: cy };
              } else {
                const prev = data.nodes.filter(m => m.hop === n.hop - 1);
                if (prev.length === 0) parent = { x: cx, y: cy };
                else {
                  let best = prev[0]!;
                  let bestD = Infinity;
                  for (const m of prev) {
                    const dx = m.x - n.x; const dy = m.y - n.y;
                    const d = dx * dx + dy * dy;
                    if (d < bestD) { bestD = d; best = m; }
                  }
                  parent = { x: best.x, y: best.y };
                }
              }
              const dash = 240;
              const alpha = Math.max(0.14, 0.6 - n.hop * 0.14);
              const width = Math.max(0.6, 1.4 - n.hop * 0.22);
              return (
                <line
                  key={`e-${n.id}`}
                  x1={parent.x} y1={parent.y}
                  x2={n.x} y2={n.y}
                  stroke={color.accent}
                  strokeOpacity={alpha}
                  strokeWidth={width}
                  strokeDasharray={`${dash}`}
                  style={{
                    ["--dash" as string]: dash.toString(),
                    animation: `ci-draw 640ms cubic-bezier(0.22, 1, 0.28, 1) both`,
                    animationDelay: `${180 + i * 10}ms`,
                  }}
                />
              );
            })}

            {/* Nodes */}
            {data.nodes.map((n, i) => {
              const isCenter = n.hop === 0;
              const fade = isCenter ? 1 : Math.max(0.3, 1 - (n.hop - 1) * 0.2);
              const tint = kindColor[n.kind] ?? color.text1;
              const r = isCenter ? 18 : Math.max(4, 9 - n.hop);
              return (
                <g
                  key={n.id}
                  style={{
                    cursor: "pointer",
                    opacity: fade,
                    animation: `ci-enter 520ms cubic-bezier(0.22, 1, 0.28, 1) both`,
                    animationDelay: `${60 + i * 12}ms`,
                    transition: "opacity 180ms ease-out",
                  }}
                  onClick={() => onFocusEntity?.(n.id)}
                >
                  <circle
                    cx={n.x} cy={n.y} r={r}
                    fill={isCenter ? color.accentSoft : tint}
                    fillOpacity={isCenter ? 1 : 0.18}
                    stroke={isCenter ? color.accent : tint}
                    strokeWidth={isCenter ? 2 : 1.1}
                  />
                  {!isCenter && (
                    <circle
                      cx={n.x} cy={n.y} r={Math.max(1.8, r * 0.38)}
                      fill={tint}
                      fillOpacity={0.9}
                    />
                  )}
                  {isCenter && (
                    <text
                      x={n.x} y={n.y + 4}
                      fontFamily={font.mono}
                      fontSize={14}
                      fontWeight={font.weight.semibold}
                      fill={color.accent}
                      textAnchor="middle"
                    >
                      {data.total}
                    </text>
                  )}
                  {!isCenter && n.hop <= 2 && (
                    <text
                      x={n.x + r + 4}
                      y={n.y + 3}
                      fontFamily={font.sans}
                      fontSize={9.5}
                      fill={color.text2}
                      style={{ userSelect: "none" }}
                    >
                      {n.label.length > 18 ? n.label.slice(0, 16) + "…" : n.label}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Ring count badges */}
            {[1, 2, 3].map(hop => {
              const count = hop < 3
                ? (hop === 1 ? data.one : data.two)
                : data.threePlus;
              if (count === 0) return null;
              const r = hop * RING_STEP;
              const labelX = cx + r * Math.cos(-Math.PI / 4);
              const labelY = cy + r * Math.sin(-Math.PI / 4);
              return (
                <g key={`rb-${hop}`}>
                  <rect
                    x={labelX - 32} y={labelY - 11}
                    width={64} height={22}
                    rx={radius.pill} ry={radius.pill}
                    fill={color.bg1}
                    stroke={color.accentBorder}
                    strokeWidth={1}
                  />
                  <text
                    x={labelX} y={labelY + 4}
                    fontFamily={font.sans}
                    fontSize={10}
                    fontWeight={font.weight.semibold}
                    fill={color.accent}
                    textAnchor="middle"
                  >
                    {hop < 3 ? `${hop}hop · ${count}` : `3+hop · ${count}`}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <aside style={panelStyle}>
          <div style={{ fontSize: font.size.xs, color: color.text3, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: space[3] }}>
            Impact breakdown
          </div>

          <Row label="1-hop (direct)" count={data.one} tint={color.accent} />
          <Row label="2-hop (indirect)" count={data.two} tint={color.accent} dim={0.7} />
          <Row label="3+ hop (far)" count={data.threePlus} tint={color.accent} dim={0.48} />

          <div style={{ height: 1, background: color.border, margin: `${space[3]}px 0` }} />

          <Row label="Total closure" count={data.total} tint={color.text0} bold />
        </aside>
      </div>
    </div>
  );
}

function Row({ label, count, tint, dim, bold }: { label: string; count: number; tint: string; dim?: number; bold?: boolean }) {
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "baseline",
      padding: `${space[2]}px 0`,
      opacity: dim ?? 1,
    }}>
      <span style={{ fontSize: font.size.sm, color: color.text1 }}>{label}</span>
      <span style={{
        fontFamily: font.mono,
        fontSize: bold ? font.size.xl : font.size.lg,
        fontWeight: font.weight.semibold,
        color: tint,
      }}>
        {count}
      </span>
    </div>
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
  animation: "ci-enter 520ms cubic-bezier(0.22, 1, 0.28, 1) both",
};

const headerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  marginBottom: space[4],
};

const bodyStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: "flex",
  gap: space[4],
};

const canvasWrapStyle: CSSProperties = {
  flex: "0 0 auto",
  minHeight: 0,
  overflow: "hidden",
  borderRadius: radius.md,
};

const svgStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "block",
};

const panelStyle: CSSProperties = {
  width: 260,
  padding: space[4],
  background: color.bg2,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  display: "flex",
  flexDirection: "column",
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

export const ChangeImpactView = memo(ChangeImpactViewImpl);
