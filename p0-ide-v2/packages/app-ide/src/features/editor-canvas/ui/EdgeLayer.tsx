import { memo } from "react";
import type { CanvasEdge, CanvasGraph, CodePane } from "@quanta/app-ide/entities/canvas";
import { cn } from "@quanta/ui-kit/lib";

// ── Constants ─────────────────────────────────────────────────────────

const PRIORITY: Record<CanvasEdge["kind"], number> = { taint: 3, call: 2, dep: 1 };

const DOT_R        = 3.5;
const DOT_SPACING  = 9;    // center-to-center between sibling dots
const IN_BASE      = 8;    // inbound:  first dot at codePane.x + IN_BASE, grows →
const OUT_BASE     = 8;    // outbound: rightmost dot at codePane.x + codePane.w + OUT_BASE, grows ←

// ── Dedup key ─────────────────────────────────────────────────────────

function dotKey(edge: CanvasEdge): string {
  return edge.symbolLen > 0
    ? `${edge.line}:${edge.side}:${edge.col}`
    : `${edge.line}:${edge.side}:bare`;
}

// ── Geometry helpers ──────────────────────────────────────────────────

function lineY(codePane: CodePane, line: number): number {
  return codePane.y + (line - 1) * codePane.lineHeight + codePane.lineHeight / 2;
}

interface DotPos { cx: number; cy: number; }

// ── Style maps ─────────────────────────────────────────────────────────

const EDGE_CLASS: Record<CanvasEdge["kind"], string> = {
  taint: "canvas-edge--taint",
  call:  "canvas-edge--call",
  dep:   "canvas-edge--dep",
};

const DOT_CLASS: Record<CanvasEdge["kind"], string> = {
  taint: "canvas-dot--taint",
  call:  "canvas-dot--call",
  dep:   "canvas-dot--dep",
};

// ── Component ──────────────────────────────────────────────────────────

interface Props {
  graph: CanvasGraph;
  activeEdges?: Set<string>;
  onEdgeClick?: (edgeId: string) => void;
}

export const EdgeLayer = memo(function EdgeLayer({ graph, activeEdges, onEdgeClick }: Props) {
  const { codePane } = graph;

  const extRects = new Map<string, { x: number; y: number; w: number; h: number }>();
  for (const n of graph.externalNodes) extRects.set(n.id, n);

  // ── Precompute taint routes once O(n) — avoids O(n²) inside render ──
  const taintRouteSet = new Set<string>();
  for (const e of graph.edges) {
    if (e.kind === "taint") taintRouteSet.add(`${e.line}:${e.extNodeId}`);
  }

  // ── 1. Representative edge per dot key ────────────────────────────────
  const dotRep = new Map<string, CanvasEdge>();
  for (const edge of graph.edges) {
    const key = dotKey(edge);
    const cur = dotRep.get(key);
    if (!cur || (PRIORITY[edge.kind] ?? 0) > (PRIORITY[cur.kind] ?? 0)) {
      dotRep.set(key, edge);
    }
  }

  // ── 2. Split into inbound / outbound groups per line ──────────────────
  interface DotEntry { key: string; rep: CanvasEdge; }
  const inByLine  = new Map<number, DotEntry[]>(); // side === "left"
  const outByLine = new Map<number, DotEntry[]>(); // side === "right"

  for (const [key, rep] of dotRep) {
    const target = rep.side === "left" ? inByLine : outByLine;
    const list = target.get(rep.line) ?? [];
    list.push({ key, rep });
    target.set(rep.line, list);
  }

  // Sort by col within each group
  const byCol = (a: DotEntry, b: DotEntry) => (a.rep.col ?? 0) - (b.rep.col ?? 0);
  for (const l of inByLine.values())  l.sort(byCol);
  for (const l of outByLine.values()) l.sort(byCol);

  // ── 3. Assign positions ───────────────────────────────────────────────
  //
  // Inbound  (left side):  left-anchored  at codePane.x + IN_BASE,  grows →
  // Outbound (right side): right-anchored at codePane.x + w + OUT_BASE, grows ←

  const dotPos = new Map<string, DotPos>();

  for (const [line, list] of inByLine) {
    const cy = lineY(codePane, line);
    list.forEach(({ key }, idx) => {
      dotPos.set(key, { cx: codePane.x + IN_BASE + idx * DOT_SPACING, cy });
    });
  }

  for (const [line, list] of outByLine) {
    const cy = lineY(codePane, line);
    const n  = list.length;
    list.forEach(({ key }, idx) => {
      // right-aligned: rightmost (last idx) sits at OUT_BASE from pane right edge
      dotPos.set(key, {
        cx: codePane.x + codePane.w + OUT_BASE - (n - 1 - idx) * DOT_SPACING,
        cy,
      });
    });
  }

  function getPos(edge: CanvasEdge): DotPos {
    return dotPos.get(dotKey(edge)) ?? { cx: 0, cy: lineY(codePane, edge.line) };
  }

  // ── 4. Edge path ──────────────────────────────────────────────────────
  function buildPath(edge: CanvasEdge, dot: DotPos): string {
    const extRect = extRects.get(edge.extNodeId)!;
    let x1: number, y1: number, x2: number, y2: number;

    if (edge.side === "left") {
      // inbound: ext right → dot (dot is on left side of code)
      x1 = extRect.x + extRect.w;  y1 = extRect.y + extRect.h / 2;
      x2 = dot.cx - DOT_R;         y2 = dot.cy;
    } else {
      // outbound: dot → ext left (dot is on right side of code)
      x1 = dot.cx + DOT_R;  y1 = dot.cy;
      x2 = extRect.x;        y2 = extRect.y + extRect.h / 2;
    }

    const dx = Math.abs(x2 - x1);
    const dy = y2 - y1;
    const cpX = Math.max(dx * 0.4, 40);
    const cpY = dy * 0.15;
    return `M ${x1} ${y1} C ${x1 + cpX} ${y1 + cpY}, ${x2 - cpX} ${y2 - cpY}, ${x2} ${y2}`;
  }

  return (
    <svg
      className="canvas-view__svg canvas-view__svg--edges"
      width={graph.width}
      height={graph.height}
    >
      <defs>
        <marker id="arrow-call" viewBox="0 0 8 8" refX="8" refY="4" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 8 4 L 0 8 Z" fill="var(--border-strong)" />
        </marker>
        <marker id="arrow-taint" viewBox="0 0 8 8" refX="8" refY="4" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 0 L 8 4 L 0 8 Z" fill="var(--danger)" />
        </marker>
        <marker id="arrow-dep" viewBox="0 0 8 8" refX="8" refY="4" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M 0 0 L 8 4 L 0 8 Z" fill="var(--fg-subtle)" />
        </marker>
      </defs>

      {/* Edge paths — suppress dep/call when taint exists on same route */}
      {graph.edges.map((edge) => {
        if (!extRects.has(edge.extNodeId)) return null;

        // If a taint edge exists on the same line→node, hide the dep/call edge
        if (edge.kind !== "taint" && taintRouteSet.has(`${edge.line}:${edge.extNodeId}`)) return null;

        const dot = getPos(edge);
        const isActive = activeEdges?.has(edge.id);

        return (
          <g
            key={edge.id}
            className="canvas-edge-group"
            onClick={(e) => { e.stopPropagation(); onEdgeClick?.(edge.id); }}
          >
            <path
              className={cn(
                "canvas-edge",
                EDGE_CLASS[edge.kind],
                isActive && "canvas-edge--active",
                edge.confidence === "low"  && "canvas-edge--confidence-low",
                edge.confidence === "high" && "canvas-edge--confidence-high",
              )}
              d={buildPath(edge, dot)}
              markerEnd={`url(#arrow-${edge.kind})`}
              style={edge.kind !== "taint" ? { stroke: edge.color } : undefined}
            />
            {edge.label && (() => {
              const extRect = extRects.get(edge.extNodeId)!;
              const ex = edge.side === "left" ? extRect.x + extRect.w : extRect.x;
              const ey = extRect.y + extRect.h / 2;
              return (
                <>
                  <rect className="canvas-edge__label-bg"
                    x={(dot.cx + ex) / 2 - edge.label.length * 3 - 4}
                    y={(dot.cy + ey) / 2 - 8}
                    width={edge.label.length * 6 + 8} height={16} rx="3"
                  />
                  <text className="canvas-edge__label"
                    x={(dot.cx + ex) / 2} y={(dot.cy + ey) / 2 + 4} textAnchor="middle"
                  >
                    {edge.label}
                  </text>
                </>
              );
            })()}
          </g>
        );
      })}

      {/* Dots */}
      {[...dotRep.entries()].map(([key, rep]) => {
        const pos = dotPos.get(key);
        if (!pos) return null;
        // activeEdges가 없으면 false, 있으면 rep.id가 포함되어 있는지만 확인
        const isActive = activeEdges?.has(rep.id) ?? false;

        return (
          <circle
            key={`dot-${key}`}
            className={cn("canvas-dot", DOT_CLASS[rep.kind], isActive && "canvas-dot--active")}
            cx={pos.cx}
            cy={pos.cy}
            r={DOT_R}
            onClick={(e) => { e.stopPropagation(); onEdgeClick?.(rep.id); }}
          />
        );
      })}
    </svg>
  );
});
