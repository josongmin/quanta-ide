// OwnershipSankeyView — author handoff Sankey.
// --------------------------------------------------------------------
// Aggregates `ownershipTransitions(file)` across every file and draws
// the flow from "original author" → "current author" as Sankey bands.
// Band thickness is proportional to file count.
//
// Reference: Sankey (1898). Modern D3 `d3-sankey` layout.
// We don't pull d3-sankey — this is two Y-stacked columns with Bezier
// ribbons between them. That's enough for the ownership story and
// keeps the bundle lean.

import {
  memo,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactElement,
} from "react";

import type { Entity } from "@quanta/canvas-engine";
import type { EntityTree } from "../../../entities/entity";
import {
  color,
  font,
  radius,
  space,
} from "../../../shared/ui/tokens";
import {
  authorHue,
  ownershipTransitions,
  primaryAuthor,
} from "../../../shared/analytics/synth-metrics";

const VIEW_W = 1100;
const VIEW_H = 620;
const MARGIN_Y = 48;
const COL_W = 18;
const LEFT_X = 180;
const RIGHT_X = VIEW_W - 180 - COL_W;
const GAP = 6;                   // px between stacked nodes in a column

const KEYFRAMES = `
@keyframes osEnter {
  0%   { opacity: 0; transform: scale(0.97); }
  100% { opacity: 1; transform: scale(1); }
}
@keyframes osDraw {
  0%   { stroke-dashoffset: var(--dash); opacity: 0; }
  30%  { opacity: 0.7; }
  100% { stroke-dashoffset: 0; opacity: 0.7; }
}
@keyframes osNode {
  0%   { opacity: 0; transform: translateX(-6px); }
  100% { opacity: 1; transform: translateX(0); }
}
`;

interface AuthorNode {
  id: string;
  total: number;
  y0: number;
  y1: number;
  hue: number;
}

interface Flow {
  id: string;
  from: string;
  to: string;
  count: number;
  fromY: number;
  toY: number;
  thickness: number;
  color: string;
  fileIds: string[];
}

export interface OwnershipSankeyViewProps {
  tree: EntityTree;
  onFocusEntity?: (id: string) => void;
}

function OwnershipSankeyViewImpl({
  tree,
  onFocusEntity,
}: OwnershipSankeyViewProps): ReactElement {
  const [hoveredFlowId, setHoveredFlowId] = useState<string | null>(null);

  useEffect(() => {
    const s = document.createElement("style");
    s.textContent = KEYFRAMES;
    s.dataset.ownershipSankeyKeyframes = "1";
    document.head.appendChild(s);
    return () => { s.remove(); };
  }, []);

  const { leftNodes, rightNodes, flows } = useMemo(
    () => buildSankey(tree),
    [tree],
  );

  if (flows.length === 0) {
    return (
      <div style={{ ...rootStyle, alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: color.text3, fontSize: font.size.md }}>
          소유권 이전 이력이 없습니다
        </div>
      </div>
    );
  }

  const hoveredFlow = flows.find(f => f.id === hoveredFlowId) ?? null;
  const hoveredLeft = hoveredFlow?.from;
  const hoveredRight = hoveredFlow?.to;

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>
      <header style={headerStyle}>
        <div>
          <div style={titleStyle}>Ownership Handoff</div>
          <div style={subtitleStyle}>
            Sankey of author transitions · git-blame primary owner tracking
          </div>
        </div>
        <div style={countsStyle}>
          <span style={{ color: color.text2 }}>handoffs</span>
          <span style={{ fontWeight: font.weight.bold, marginLeft: 4 }}>
            {flows.reduce((a, f) => a + f.count, 0)}
          </span>
        </div>
      </header>

      <div style={canvasWrapStyle}>
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="xMidYMid meet"
          style={svgStyle}
        >
          {/* Column labels */}
          <text
            x={LEFT_X + COL_W / 2} y={30}
            textAnchor="middle"
            fontFamily={font.sans}
            fontSize={11}
            letterSpacing="0.08em"
            fill={color.text2}
          >
            ORIGINAL
          </text>
          <text
            x={RIGHT_X + COL_W / 2} y={30}
            textAnchor="middle"
            fontFamily={font.sans}
            fontSize={11}
            letterSpacing="0.08em"
            fill={color.text2}
          >
            CURRENT
          </text>

          {/* Flows */}
          {flows.map((f, i) => {
            const isHovered = hoveredFlowId === f.id;
            const dimmed = hoveredFlowId && !isHovered;
            const path = ribbonPath(
              LEFT_X + COL_W, f.fromY,
              RIGHT_X,        f.toY,
            );
            const dash = 400;
            return (
              <path
                key={f.id}
                d={path}
                fill="none"
                stroke={f.color}
                strokeWidth={f.thickness}
                strokeLinecap="butt"
                strokeOpacity={isHovered ? 0.95 : dimmed ? 0.12 : 0.48}
                strokeDasharray={dash}
                style={{
                  ["--dash" as string]: dash.toString(),
                  animation: `osDraw 700ms cubic-bezier(0.22, 1, 0.28, 1) both`,
                  animationDelay: `${Math.min(140 + i * 28, 720)}ms`,
                  cursor: "pointer",
                  transition: "stroke-opacity 180ms ease-out",
                }}
                onMouseEnter={() => setHoveredFlowId(f.id)}
                onMouseLeave={() => setHoveredFlowId(null)}
                onClick={() => {
                  if (f.fileIds.length > 0) onFocusEntity?.(f.fileIds[0]!);
                }}
              >
                <title>
                  {f.from} → {f.to} · {f.count} file{f.count === 1 ? "" : "s"}
                </title>
              </path>
            );
          })}

          {/* Author nodes — left */}
          {leftNodes.map((n, i) => (
            <AuthorBar
              key={`l-${n.id}`}
              node={n}
              side="left"
              active={hoveredLeft === n.id}
              dim={hoveredLeft != null && hoveredLeft !== n.id}
              index={i}
            />
          ))}
          {/* Author nodes — right */}
          {rightNodes.map((n, i) => (
            <AuthorBar
              key={`r-${n.id}`}
              node={n}
              side="right"
              active={hoveredRight === n.id}
              dim={hoveredRight != null && hoveredRight !== n.id}
              index={i}
            />
          ))}

          {/* Hover chip */}
          {hoveredFlow && (
            <g transform={`translate(${VIEW_W / 2 - 110}, ${VIEW_H - 56})`}>
              <rect
                x={0} y={0} width={220} height={42}
                rx={8} ry={8}
                fill={color.bg0}
                stroke={color.border}
                strokeWidth={0.8}
                style={{ filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.08))" }}
              />
              <circle cx={12} cy={14} r={5} fill={`hsl(${authorHue(hoveredFlow.from)} 60% 58%)`} />
              <text x={22} y={18} fontFamily={font.sans} fontSize={12} fill={color.text0}>
                {hoveredFlow.from}
              </text>
              <text x={104} y={18} fontFamily={font.sans} fontSize={12} fill={color.text2}>→</text>
              <circle cx={122} cy={14} r={5} fill={`hsl(${authorHue(hoveredFlow.to)} 60% 58%)`} />
              <text x={132} y={18} fontFamily={font.sans} fontSize={12} fill={color.text0}>
                {hoveredFlow.to}
              </text>
              <text x={12} y={34} fontFamily={font.sans} fontSize={10} fill={color.text1} style={{ fontVariantNumeric: "tabular-nums" }}>
                {hoveredFlow.count} file{hoveredFlow.count === 1 ? "" : "s"}
              </text>
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}

function AuthorBar({
  node,
  side,
  active,
  dim,
  index,
}: {
  node: AuthorNode;
  side: "left" | "right";
  active: boolean;
  dim: boolean;
  index: number;
}) {
  const x = side === "left" ? LEFT_X : RIGHT_X;
  const barFill = `hsl(${node.hue} 60% 58%)`;
  const barHeight = node.y1 - node.y0;
  const labelX = side === "left" ? x - 12 : x + COL_W + 12;
  const textAnchor = side === "left" ? "end" : "start";
  return (
    <g
      style={{
        animation: `osNode 420ms cubic-bezier(0.22, 1, 0.28, 1) both`,
        animationDelay: `${Math.min(40 + index * 40, 360)}ms`,
        opacity: dim ? 0.4 : 1,
        transition: "opacity 180ms ease-out",
      }}
    >
      <rect
        x={x}
        y={node.y0}
        width={COL_W}
        height={barHeight}
        fill={barFill}
        stroke={active ? color.text0 : "rgba(20, 30, 45, 0.18)"}
        strokeWidth={active ? 1.2 : 0.7}
        rx={2}
        ry={2}
      />
      <text
        x={labelX}
        y={node.y0 + barHeight / 2 + 3}
        fontFamily={font.sans}
        fontSize={11}
        fontWeight={active ? font.weight.bold : font.weight.medium}
        fill={color.text0}
        textAnchor={textAnchor}
      >
        {node.id}
      </text>
      <text
        x={labelX}
        y={node.y0 + barHeight / 2 + 16}
        fontFamily={font.sans}
        fontSize={9}
        fill={color.text2}
        textAnchor={textAnchor}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {node.total} file{node.total === 1 ? "" : "s"}
      </text>
    </g>
  );
}

// ── Sankey layout ─────────────────────────────────────────────────────
function buildSankey(tree: EntityTree) {
  const files = Array.from(tree.byId.values()).filter(e => e.kind === "building");
  if (files.length === 0) {
    return { leftNodes: [] as AuthorNode[], rightNodes: [] as AuthorNode[], flows: [] as Flow[] };
  }

  // Aggregate (from, to) pairs across all files.
  const pairCounts = new Map<string, { from: string; to: string; count: number; fileIds: string[] }>();
  const leftTotals = new Map<string, number>();
  const rightTotals = new Map<string, number>();

  for (const f of files) {
    const transitions = ownershipTransitions(f as Entity);
    let originalAuthor: string;
    let currentAuthor: string;
    if (transitions.length === 0) {
      // No transitions — original == current.
      const pa = primaryAuthor(f as Entity);
      originalAuthor = pa;
      currentAuthor = pa;
    } else {
      originalAuthor = transitions[0]!.from;
      currentAuthor = transitions[transitions.length - 1]!.to;
    }
    if (originalAuthor === currentAuthor) continue;   // no handoff, skip

    const key = `${originalAuthor}→${currentAuthor}`;
    const existing = pairCounts.get(key);
    if (existing) {
      existing.count += 1;
      existing.fileIds.push(f.id);
    } else {
      pairCounts.set(key, { from: originalAuthor, to: currentAuthor, count: 1, fileIds: [f.id] });
    }
    leftTotals.set(originalAuthor, (leftTotals.get(originalAuthor) ?? 0) + 1);
    rightTotals.set(currentAuthor, (rightTotals.get(currentAuthor) ?? 0) + 1);
  }

  // Sort authors by total desc for predictable stacking.
  const leftSorted = [...leftTotals.entries()].sort((a, b) => b[1] - a[1]);
  const rightSorted = [...rightTotals.entries()].sort((a, b) => b[1] - a[1]);

  const availH = VIEW_H - 2 * MARGIN_Y;
  const sumLeft = leftSorted.reduce((a, [, v]) => a + v, 0);
  const sumRight = rightSorted.reduce((a, [, v]) => a + v, 0);
  // Subtract gaps so scale doesn't over-pack.
  const gapsLeft = Math.max(0, leftSorted.length - 1) * GAP;
  const gapsRight = Math.max(0, rightSorted.length - 1) * GAP;
  const scaleLeft = sumLeft > 0 ? (availH - gapsLeft) / sumLeft : 0;
  const scaleRight = sumRight > 0 ? (availH - gapsRight) / sumRight : 0;

  const leftNodes: AuthorNode[] = [];
  const rightNodes: AuthorNode[] = [];

  let ly = MARGIN_Y;
  for (const [id, total] of leftSorted) {
    const h = Math.max(6, total * scaleLeft);
    leftNodes.push({ id, total, y0: ly, y1: ly + h, hue: authorHue(id) });
    ly += h + GAP;
  }
  let ry = MARGIN_Y;
  for (const [id, total] of rightSorted) {
    const h = Math.max(6, total * scaleRight);
    rightNodes.push({ id, total, y0: ry, y1: ry + h, hue: authorHue(id) });
    ry += h + GAP;
  }

  // Allocate flow "sub-bands" by cumulative y per author.
  const leftCursor = new Map<string, number>();
  const rightCursor = new Map<string, number>();
  for (const n of leftNodes) leftCursor.set(n.id, n.y0);
  for (const n of rightNodes) rightCursor.set(n.id, n.y0);

  // Order flows largest-first so small ones stack on top without gaps.
  const orderedPairs = [...pairCounts.values()].sort((a, b) => b.count - a.count);

  const flows: Flow[] = [];
  for (const p of orderedPairs) {
    const thickness = Math.max(2, p.count * Math.min(scaleLeft, scaleRight));
    const fromY = (leftCursor.get(p.from) ?? MARGIN_Y) + thickness / 2;
    const toY = (rightCursor.get(p.to) ?? MARGIN_Y) + thickness / 2;
    leftCursor.set(p.from, (leftCursor.get(p.from) ?? MARGIN_Y) + thickness);
    rightCursor.set(p.to, (rightCursor.get(p.to) ?? MARGIN_Y) + thickness);
    flows.push({
      id: `${p.from}->${p.to}`,
      from: p.from,
      to: p.to,
      count: p.count,
      fromY,
      toY,
      thickness,
      color: `hsl(${authorHue(p.from)} 60% 58%)`,
      fileIds: p.fileIds,
    });
  }

  return { leftNodes, rightNodes, flows };
}

function ribbonPath(x0: number, y0: number, x1: number, y1: number): string {
  const midX = (x0 + x1) / 2;
  return `M${x0},${y0} C${midX},${y0} ${midX},${y1} ${x1},${y1}`;
}

// ── Styles ────────────────────────────────────────────────────────────
const rootStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  background: color.bg0,
  padding: `${space[6]}px ${space[7]}px`,
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  fontFamily: font.sans,
  color: color.text0,
  animation: "osEnter 520ms cubic-bezier(0.22, 1, 0.28, 1) both",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  marginBottom: space[4],
  gap: space[4],
};

const titleStyle: CSSProperties = {
  fontSize: font.size.xxl,
  fontWeight: font.weight.bold,
  letterSpacing: font.letter.tight,
};

const subtitleStyle: CSSProperties = {
  fontSize: font.size.xs,
  color: color.text2,
  marginTop: space[1],
};

const countsStyle: CSSProperties = {
  fontSize: font.size.xs,
  color: color.text1,
  fontVariantNumeric: "tabular-nums",
};

const canvasWrapStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflow: "hidden",
  borderRadius: radius.md,
  border: `1px solid ${color.border}`,
  background: color.bg2,
};

const svgStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "block",
};

export const OwnershipSankeyView = memo(OwnershipSankeyViewImpl);
