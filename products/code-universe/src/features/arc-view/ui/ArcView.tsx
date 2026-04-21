// ArcView — SVG renderer for the arc diagram / cycle detection view.
// --------------------------------------------------------------------
// Files (or packages) are arranged horizontally in topological order.
// Import arcs bow ABOVE the centre baseline (blue); backward edges
// that create cycles bow BELOW the baseline (red).
//
// z-order (bottom → top):
//   1. Backdrop rect (click-outside → onDismiss)
//   2. Axis line
//   3. Arc edges (forward above, backward below)
//   4. Node circles + cycle rings
//   5. Labels + sublabels
//   6. Summary bar (top text overlay)
//   7. Overflow note (bottom-right)
//
// Hover interactions:
//   - Hover a node: incident arcs highlight (outbound blue, inbound
//     green, backward red); non-incident arcs dim to 0.08.
//   - Hover an arc: it highlights and shows a tooltip; others dim.
//   - Click a node: onFocusEntity?.(node.id)
//   - Click backdrop: onDismiss?.()

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties, MouseEvent, PointerEvent } from "react";
import { color as tokenColor } from "../../../shared/ui/tokens";
import type { ArcEdge, ArcLayout, ArcNode } from "../model/types";

// ── Constants ─────────────────────────────────────────────────────────

const ENTRY_MS = 280;
const NODE_RADIUS = 7;
const CYCLE_RING_RADIUS = 10;
const LABEL_FONT_SIZE = 10;
const SUBLABEL_FONT_SIZE = 9;
const LABEL_MAX_CHARS = 14;
const ARC_AMBIENT_OPACITY = 0.45;
const ARC_DIM_OPACITY = 0.08;
const ARC_HOVER_OPACITY = 0.9;
const FORWARD_COLOR = "#3b82f6";
const BACKWARD_COLOR = "#ef4444";
const CYCLE_RING_COLOR = "#ef4444";
const INBOUND_HIGHLIGHT = "#22c55e"; // bright green for inbound on hover

// ── Prop types ────────────────────────────────────────────────────────

export interface ArcViewProps {
  layout: ArcLayout;
  width: number;
  height: number;
  onFocusEntity?: (id: string) => void;
  onDismiss?: () => void;
}

// ── Hover state ───────────────────────────────────────────────────────

type HoverTarget =
  | { kind: "node"; id: string }
  | { kind: "edge"; id: string }
  | null;

// ── Tooltip ───────────────────────────────────────────────────────────

interface TooltipState {
  text: string;
  x: number;
  y: number;
}

// ── Helpers ───────────────────────────────────────────────────────────

function truncateLabel(s: string): string {
  if (s.length <= LABEL_MAX_CHARS) return s;
  return s.slice(0, LABEL_MAX_CHARS - 1) + "…";
}

function arcStrokeWidth(weight: number): number {
  return 0.5 + Math.log2(weight + 1) * 0.8;
}

// ── Edge path ─────────────────────────────────────────────────────────

/**
 * Quadratic bezier arc path.
 * - Forward arcs bow ABOVE: control point at (midX, centerY - height)
 * - Backward arcs bow BELOW: control point at (midX, centerY + height)
 */
function buildArcPath(
  fromX: number,
  toX: number,
  centerY: number,
  arcHeight: number,
  isBackward: boolean,
): string {
  const midX = (fromX + toX) / 2;
  const cpY = isBackward ? centerY + arcHeight : centerY - arcHeight;
  return `M ${fromX},${centerY} Q ${midX},${cpY} ${toX},${centerY}`;
}

// ── Edge component ────────────────────────────────────────────────────

interface ArcEdgeSvgProps {
  edge: ArcEdge;
  fromNode: ArcNode;
  toNode: ArcNode;
  centerY: number;
  opacity: number;
  strokeWidth: number;
  stroke: string;
  onPointerEnter: (id: string, x: number, y: number) => void;
  onPointerLeave: () => void;
}

function ArcEdgeSvg({
  edge,
  fromNode,
  toNode,
  centerY,
  opacity,
  strokeWidth,
  stroke,
  onPointerEnter,
  onPointerLeave,
}: ArcEdgeSvgProps) {
  const d = buildArcPath(fromNode.x, toNode.x, centerY, edge.height, edge.isBackward);

  const handlePointerEnter = useCallback(
    (ev: PointerEvent<SVGPathElement>) => {
      onPointerEnter(edge.id, ev.clientX, ev.clientY);
    },
    [edge.id, onPointerEnter],
  );

  return (
    <path
      d={d}
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      opacity={opacity}
      style={{ cursor: "default", pointerEvents: "stroke" }}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={onPointerLeave}
    />
  );
}

// ── Node component ────────────────────────────────────────────────────

interface ArcNodeSvgProps {
  node: ArcNode;
  centerY: number;
  dimmed: boolean;
  highlighted: boolean;
  onPointerEnter: (id: string, x: number, y: number) => void;
  onPointerLeave: () => void;
  onFocus: (id: string) => void;
}

function ArcNodeSvg({
  node,
  centerY,
  dimmed,
  highlighted,
  onPointerEnter,
  onPointerLeave,
  onFocus,
}: ArcNodeSvgProps) {
  const opacity = dimmed ? 0.3 : 1;
  const labelColor = node.inCycle ? "#ef4444" : tokenColor.text1;

  const handlePointerEnter = useCallback(
    (ev: PointerEvent<SVGGElement>) => {
      onPointerEnter(node.id, ev.clientX, ev.clientY);
    },
    [node.id, onPointerEnter],
  );

  const handleClick = useCallback(
    (ev: MouseEvent<SVGGElement>) => {
      ev.stopPropagation();
      onFocus(node.id);
    },
    [node.id, onFocus],
  );

  const labelY = centerY + NODE_RADIUS + 14;
  const sublabelY = labelY + 20;

  return (
    <g
      style={{ cursor: "pointer", opacity }}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={onPointerLeave}
      onClick={handleClick}
    >
      {/* Cycle ring — outer stroke when node is in a cycle */}
      {node.inCycle && (
        <circle
          cx={node.x}
          cy={centerY}
          r={CYCLE_RING_RADIUS}
          fill="none"
          stroke={CYCLE_RING_COLOR}
          strokeWidth={highlighted ? 2 : 1.5}
          opacity={0.7}
        />
      )}
      {/* Main node circle */}
      <circle
        cx={node.x}
        cy={centerY}
        r={NODE_RADIUS}
        fill={node.color}
        fillOpacity={0.9}
        stroke="white"
        strokeWidth={1.5}
      />
      {/* Label — rotated -45° below the axis */}
      <text
        x={node.x}
        y={labelY}
        textAnchor="end"
        transform={`rotate(-45, ${node.x}, ${labelY})`}
        fontSize={LABEL_FONT_SIZE}
        fontFamily="inherit"
        fill={labelColor}
        style={{ userSelect: "none" }}
      >
        {truncateLabel(node.label)}
      </text>
      {/* Sublabel — no rotation, smaller */}
      <text
        x={node.x}
        y={sublabelY}
        textAnchor="middle"
        fontSize={SUBLABEL_FONT_SIZE}
        fontFamily="inherit"
        fill={tokenColor.text2}
        style={{ userSelect: "none" }}
      >
        {node.sublabel}
      </text>
    </g>
  );
}

// ── Main component ────────────────────────────────────────────────────

function ArcViewImpl({ layout, width, height, onFocusEntity, onDismiss }: ArcViewProps) {
  const [hover, setHover] = useState<HoverTarget>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [mounted, setMounted] = useState(false);

  // Fade-in on mount — two rAFs so initial paint has opacity 0.
  useEffect(() => {
    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setMounted(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, []);

  // Vertical centre of the horizontal axis.
  const centerY = height / 2;

  // Precompute node lookup for edge endpoints.
  const nodeById = useMemo(() => {
    const map = new Map<string, ArcNode>();
    for (const n of layout.nodes) map.set(n.id, n);
    return map;
  }, [layout.nodes]);

  // Precompute edge lookup.
  const edgeById = useMemo(() => {
    const map = new Map<string, ArcEdge>();
    for (const e of layout.edges) map.set(e.id, e);
    return map;
  }, [layout.edges]);

  // Incident edge sets per node for hover acceleration.
  const incidentEdges = useMemo(() => {
    const map = new Map<string, { outbound: Set<string>; inbound: Set<string>; backward: Set<string> }>();
    const ensure = (id: string) => {
      if (!map.has(id)) map.set(id, { outbound: new Set(), inbound: new Set(), backward: new Set() });
      return map.get(id)!;
    };
    for (const e of layout.edges) {
      const fromEntry = ensure(e.fromId);
      const toEntry = ensure(e.toId);
      if (e.isBackward) {
        fromEntry.backward.add(e.id);
        toEntry.backward.add(e.id);
      } else {
        fromEntry.outbound.add(e.id);
        toEntry.inbound.add(e.id);
      }
    }
    return map;
  }, [layout.edges]);

  // ── Hover handlers ─────────────────────────────────────────────────

  const handleNodeEnter = useCallback(
    (id: string, clientX: number, clientY: number) => {
      setHover({ kind: "node", id });
      const node = nodeById.get(id);
      if (node) {
        const cycleNote = node.inCycle ? " ⚠ in cycle" : "";
        setTooltip({ text: `${node.label} · ${node.sublabel}${cycleNote}`, x: clientX, y: clientY });
      }
    },
    [nodeById],
  );

  const handleEdgeEnter = useCallback(
    (id: string, clientX: number, clientY: number) => {
      setHover({ kind: "edge", id });
      const edge = edgeById.get(id);
      if (edge) {
        const fromNode = nodeById.get(edge.fromId);
        const toNode = nodeById.get(edge.toId);
        const fromLabel = fromNode?.label ?? edge.fromId;
        const toLabel = toNode?.label ?? edge.toId;
        const cycleNote = edge.isBackward ? " (cycle)" : "";
        setTooltip({ text: `${fromLabel} → ${toLabel}${cycleNote}`, x: clientX, y: clientY });
      }
    },
    [edgeById, nodeById],
  );

  const handleHoverLeave = useCallback(() => {
    setHover(null);
    setTooltip(null);
  }, []);

  const handleBackdropClick = useCallback(() => {
    onDismiss?.();
  }, [onDismiss]);

  const handleNodeFocus = useCallback(
    (id: string) => {
      onFocusEntity?.(id);
    },
    [onFocusEntity],
  );

  // ── Derive per-edge visual state ───────────────────────────────────

  const getEdgeStyle = useCallback(
    (edge: ArcEdge): { opacity: number; stroke: string; strokeWidth: number } => {
      const base = arcStrokeWidth(edge.weight);
      if (hover === null) {
        return {
          opacity: ARC_AMBIENT_OPACITY,
          stroke: edge.isBackward ? BACKWARD_COLOR : FORWARD_COLOR,
          strokeWidth: base,
        };
      }
      if (hover.kind === "edge") {
        if (hover.id === edge.id) {
          return {
            opacity: ARC_HOVER_OPACITY,
            stroke: edge.isBackward ? BACKWARD_COLOR : FORWARD_COLOR,
            strokeWidth: base + 1,
          };
        }
        return {
          opacity: ARC_DIM_OPACITY,
          stroke: edge.isBackward ? BACKWARD_COLOR : FORWARD_COLOR,
          strokeWidth: base,
        };
      }
      // hover.kind === "node"
      const inc = incidentEdges.get(hover.id);
      if (!inc) {
        return {
          opacity: ARC_DIM_OPACITY,
          stroke: edge.isBackward ? BACKWARD_COLOR : FORWARD_COLOR,
          strokeWidth: base,
        };
      }
      if (inc.outbound.has(edge.id)) {
        return { opacity: ARC_HOVER_OPACITY, stroke: FORWARD_COLOR, strokeWidth: base + 1 };
      }
      if (inc.inbound.has(edge.id)) {
        return { opacity: ARC_HOVER_OPACITY, stroke: INBOUND_HIGHLIGHT, strokeWidth: base + 1 };
      }
      if (inc.backward.has(edge.id)) {
        return { opacity: ARC_HOVER_OPACITY, stroke: BACKWARD_COLOR, strokeWidth: base + 1 };
      }
      return {
        opacity: ARC_DIM_OPACITY,
        stroke: edge.isBackward ? BACKWARD_COLOR : FORWARD_COLOR,
        strokeWidth: base,
      };
    },
    [hover, incidentEdges],
  );

  // ── Derive per-node visual state ──────────────────────────────────

  const getNodeState = useCallback(
    (node: ArcNode): { dimmed: boolean; highlighted: boolean } => {
      if (hover === null) return { dimmed: false, highlighted: false };
      if (hover.kind === "node") {
        if (hover.id === node.id) return { dimmed: false, highlighted: true };
        // Check adjacency: neighbour of hovered node?
        const inc = incidentEdges.get(hover.id);
        if (inc) {
          for (const e of layout.edges) {
            if (
              (inc.outbound.has(e.id) && e.toId === node.id) ||
              (inc.inbound.has(e.id) && e.fromId === node.id) ||
              (inc.backward.has(e.id) && (e.fromId === node.id || e.toId === node.id))
            ) {
              return { dimmed: false, highlighted: true };
            }
          }
        }
        return { dimmed: true, highlighted: false };
      }
      // hover.kind === "edge"
      const edge = edgeById.get(hover.id);
      if (edge && (edge.fromId === node.id || edge.toId === node.id)) {
        return { dimmed: false, highlighted: true };
      }
      return { dimmed: true, highlighted: false };
    },
    [hover, incidentEdges, edgeById, layout.edges],
  );

  const rootStyle: CSSProperties = {
    opacity: mounted ? 1 : 0,
    transition: `opacity ${ENTRY_MS}ms ease-out`,
  };

  // ── Empty state ───────────────────────────────────────────────────

  if (layout.nodes.length === 0) {
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ display: "block", userSelect: "none" }}
        role="img"
        aria-label="Arc diagram — no packages found"
      >
        <rect x={0} y={0} width={width} height={height} fill="transparent" onClick={handleBackdropClick} />
        <text
          x={width / 2}
          y={height / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={14}
          fill={tokenColor.text2}
          fontFamily="inherit"
        >
          No packages found
        </text>
      </svg>
    );
  }

  // Summary text
  const summaryText = `${layout.sccCount} cycle${layout.sccCount !== 1 ? "s" : ""} · ${layout.cycleEdgeCount} backward edge${layout.cycleEdgeCount !== 1 ? "s" : ""}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: "block", userSelect: "none", background: "transparent" }}
      role="img"
      aria-label="Arc diagram — import cycle detection view"
    >
      {/* Backdrop — transparent, full-viewport, captures click-outside. */}
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill="transparent"
        onClick={handleBackdropClick}
        style={{ cursor: onDismiss ? "default" : "inherit" }}
      />

      {/* Root group with fade-in animation */}
      <g style={rootStyle}>
        {/* Horizontal axis baseline */}
        <line
          x1={0}
          y1={centerY}
          x2={width}
          y2={centerY}
          stroke={tokenColor.border}
          strokeWidth={1}
        />

        {/* Arc edges — drawn before nodes so nodes sit on top */}
        {layout.edges.map(edge => {
          const fromNode = nodeById.get(edge.fromId);
          const toNode = nodeById.get(edge.toId);
          if (!fromNode || !toNode) return null;
          const style = getEdgeStyle(edge);
          return (
            <ArcEdgeSvg
              key={edge.id}
              edge={edge}
              fromNode={fromNode}
              toNode={toNode}
              centerY={centerY}
              opacity={style.opacity}
              strokeWidth={style.strokeWidth}
              stroke={style.stroke}
              onPointerEnter={handleEdgeEnter}
              onPointerLeave={handleHoverLeave}
            />
          );
        })}

        {/* Nodes — circles + labels */}
        {layout.nodes.map(node => {
          const state = getNodeState(node);
          return (
            <ArcNodeSvg
              key={node.id}
              node={node}
              centerY={centerY}
              dimmed={state.dimmed}
              highlighted={state.highlighted}
              onPointerEnter={handleNodeEnter}
              onPointerLeave={handleHoverLeave}
              onFocus={handleNodeFocus}
            />
          );
        })}

        {/* Summary bar — top right */}
        <text
          x={width - 20}
          y={14}
          textAnchor="end"
          fontSize={SUBLABEL_FONT_SIZE}
          fontFamily="inherit"
          fill={tokenColor.text2}
          style={{ userSelect: "none" }}
        >
          {summaryText}
        </text>

        {/* Overflow note — bottom right */}
        {layout.overflow > 0 && (
          <text
            x={width - 20}
            y={height - 10}
            textAnchor="end"
            fontSize={SUBLABEL_FONT_SIZE}
            fontFamily="inherit"
            fill={tokenColor.text2}
            style={{ userSelect: "none" }}
          >
            +{layout.overflow} more
          </text>
        )}
      </g>

      {/* Tooltip overlay — outside the animated group so it doesn't fade */}
      {tooltip !== null && (
        <g>
          <text
            x={Math.min(tooltip.x, width - 10)}
            y={Math.max(tooltip.y - 8, 14)}
            textAnchor="middle"
            fontSize={SUBLABEL_FONT_SIZE}
            fontFamily="inherit"
            fill={tokenColor.text0}
            paintOrder="stroke"
            stroke="white"
            strokeWidth={3}
            style={{ userSelect: "none", pointerEvents: "none" }}
          >
            {tooltip.text}
          </text>
        </g>
      )}
    </svg>
  );
}

export const ArcView = memo(ArcViewImpl);
