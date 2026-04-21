// ArchLayerView — SVG renderer for the Architecture Layer Flow Diagram.
// --------------------------------------------------------------------
// Renders a Sankey-style column diagram where each column is an
// architectural layer (domain, adapter, infra, ui, util, unknown).
// Ribbons between columns represent structural dependencies (import /
// call / reference). Violations are drawn in vivid red.
//
// Interactions:
//   - Hover column: dims all ribbons not connected to it.
//   - Hover ribbon: highlights it + its two endpoint columns.
//   - Click backdrop: onDismiss().
//
// Entry animation: opacity 0→1 over 280ms.

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { color as tokenColor, font } from "../../../shared/ui/tokens";
import type { ArchLayerLayout, ArchLayerNode, ArchFlowEdge } from "../model/types";

export interface ArchLayerViewProps {
  layout: ArchLayerLayout;
  width: number;
  height: number;
  onDismiss?: () => void;
}

const ENTRY_MS = 280;
const VIOLATION_COLOR = "#ef4444";
const MAX_VIOLATION_PAIRS_SHOWN = 5;
const VIOLATION_SUMMARY_X_OFFSET = 180;
const TOOLTIP_PAD = 6;
const TOOLTIP_H = 22;

// Build a unique gradient id for an allowed edge
function gradientId(fromLayer: string, toLayer: string): string {
  return `alv-grad-${fromLayer}-${toLayer}`;
}

interface TooltipState {
  x: number;
  y: number;
  text: string;
}

function ArchLayerViewImpl({ layout, width, height, onDismiss }: ArchLayerViewProps) {
  const [mounted, setMounted] = useState(false);
  const [hoveredLayer, setHoveredLayer] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  // Fade-in on mount via two-rAF trick.
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

  // Index nodes by layer for fast lookup.
  const nodeByLayer = useMemo(() => {
    const m = new Map<string, ArchLayerNode>();
    for (const n of layout.nodes) m.set(n.layer, n);
    return m;
  }, [layout.nodes]);

  // For each edge, build a set of connected layer ids for hover logic.
  const edgeConnectedLayers = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const e of layout.edges) {
      m.set(e.id, new Set([e.fromLayer, e.toLayer]));
    }
    return m;
  }, [layout.edges]);

  // Edges connected to a hovered layer.
  const connectedEdgeIds = useMemo(() => {
    if (!hoveredLayer) return null;
    const ids = new Set<string>();
    for (const e of layout.edges) {
      if (e.fromLayer === hoveredLayer || e.toLayer === hoveredLayer) {
        ids.add(e.id);
      }
    }
    return ids;
  }, [hoveredLayer, layout.edges]);

  const handleBackdrop = useCallback(() => {
    onDismiss?.();
  }, [onDismiss]);

  // ── Edge opacity logic ──────────────────────────────────────────────
  const edgeOpacity = useCallback(
    (edge: ArchFlowEdge): number => {
      if (hoveredEdgeId) {
        return hoveredEdgeId === edge.id ? 1.0 : 0.08;
      }
      if (hoveredLayer) {
        return connectedEdgeIds?.has(edge.id) ? 0.7 : 0.08;
      }
      return edge.category === "violation" ? 0.7 : 0.4;
    },
    [hoveredEdgeId, hoveredLayer, connectedEdgeIds],
  );

  // ── Column (node) highlight ──────────────────────────────────────────
  const nodeHighlighted = useCallback(
    (layer: string): boolean => {
      if (hoveredLayer) return hoveredLayer === layer;
      if (hoveredEdgeId) {
        const connected = edgeConnectedLayers.get(hoveredEdgeId);
        return connected?.has(layer) ?? false;
      }
      return false;
    },
    [hoveredLayer, hoveredEdgeId, edgeConnectedLayers],
  );

  // ── Tooltip handlers ────────────────────────────────────────────────
  const onNodeMouseEnter = useCallback(
    (e: React.MouseEvent<SVGElement>, node: ArchLayerNode) => {
      setHoveredLayer(node.layer);
      setTooltip({
        x: node.x,
        y: node.y - TOOLTIP_H - TOOLTIP_PAD,
        text: `${node.fileCount} files · ${node.totalLoc} LoC · ↑${node.inboundEdgeCount} ↓${node.outboundEdgeCount}`,
      });
      e.stopPropagation();
    },
    [],
  );

  const onNodeMouseLeave = useCallback(() => {
    setHoveredLayer(null);
    setTooltip(null);
  }, []);

  const onEdgeMouseEnter = useCallback(
    (e: React.MouseEvent<SVGElement>, edge: ArchFlowEdge) => {
      setHoveredEdgeId(edge.id);
      const midX = (e.currentTarget.getBoundingClientRect().left + e.currentTarget.getBoundingClientRect().right) / 2;
      setTooltip({
        x: midX,
        y: Math.min(edge.fromY, edge.toY) - TOOLTIP_H - TOOLTIP_PAD,
        text: `${edge.fromLayer} → ${edge.toLayer}: ${edge.edgeCount} edges (${edge.category})`,
      });
      e.stopPropagation();
    },
    [],
  );

  const onEdgeMouseLeave = useCallback(() => {
    setHoveredEdgeId(null);
    setTooltip(null);
  }, []);

  const rootStyle: CSSProperties = {
    opacity: mounted ? 1 : 0,
    transition: `opacity ${ENTRY_MS}ms ease-out`,
  };

  // ── Empty state ─────────────────────────────────────────────────────
  if (layout.nodes.length === 0) {
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ display: "block", userSelect: "none", background: "transparent", ...rootStyle }}
        role="img"
        aria-label="Architecture Layer Flow Diagram — empty"
      >
        <rect x={0} y={0} width={width} height={height} fill="transparent" onClick={handleBackdrop} />
        <text
          x={width / 2}
          y={height / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={tokenColor.text2}
          fontSize={font.size.xl}
          fontFamily={font.sans}
        >
          No files with layer information found
        </text>
      </svg>
    );
  }

  // ── SVG gradients for allowed ribbons ────────────────────────────────
  const uniqueAllowedPairs = useMemo(() => {
    const seen = new Set<string>();
    return layout.edges.filter(e => {
      if (e.category !== "allowed") return false;
      const key = `${e.fromLayer}-${e.toLayer}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [layout.edges]);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: "block", userSelect: "none", background: "transparent" }}
      role="img"
      aria-label="Architecture Layer Flow Diagram"
    >
      {/* SVG defs: gradients for allowed ribbons */}
      <defs>
        {uniqueAllowedPairs.map(edge => {
          const fromNode = nodeByLayer.get(edge.fromLayer);
          const toNode = nodeByLayer.get(edge.toLayer);
          if (!fromNode || !toNode) return null;
          const isForward = fromNode.x < toNode.x;
          const gx1 = isForward ? fromNode.x : toNode.x;
          const gx2 = isForward ? toNode.x : fromNode.x;
          return (
            <linearGradient
              key={gradientId(edge.fromLayer, edge.toLayer)}
              id={gradientId(edge.fromLayer, edge.toLayer)}
              x1={gx1}
              y1="0"
              x2={gx2}
              y2="0"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor={fromNode.color} />
              <stop offset="100%" stopColor={toNode.color} />
            </linearGradient>
          );
        })}
      </defs>

      {/* Backdrop — transparent full-size, captures click-outside */}
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill="transparent"
        onClick={handleBackdrop}
        style={{ cursor: onDismiss ? "default" : "inherit" }}
      />

      <g style={rootStyle}>
        {/* ── Flow ribbons (drawn before columns so columns sit on top) ── */}
        {layout.edges.map(edge => {
          const fromNode = nodeByLayer.get(edge.fromLayer);
          const toNode = nodeByLayer.get(edge.toLayer);
          if (!fromNode || !toNode) return null;

          const opacity = edgeOpacity(edge);
          const stroke =
            edge.category === "violation"
              ? VIOLATION_COLOR
              : `url(#${gradientId(edge.fromLayer, edge.toLayer)})`;

          return (
            <path
              key={edge.id}
              d={edge.path}
              fill="none"
              stroke={stroke}
              strokeWidth={edge.fromThickness}
              opacity={opacity}
              style={{ cursor: "pointer", transition: "opacity 120ms ease" }}
              onMouseEnter={e => onEdgeMouseEnter(e, edge)}
              onMouseLeave={onEdgeMouseLeave}
            />
          );
        })}

        {/* ── Layer columns ─────────────────────────────────────────────── */}
        {layout.nodes.map(node => {
          const highlighted = nodeHighlighted(node.layer);
          const rectOpacity = hoveredLayer || hoveredEdgeId ? (highlighted ? 1.0 : 0.5) : 0.9;

          return (
            <g
              key={node.layer}
              style={{ cursor: "pointer" }}
              onMouseEnter={e => onNodeMouseEnter(e, node)}
              onMouseLeave={onNodeMouseLeave}
            >
              {/* Column rect */}
              <rect
                x={node.x - node.width / 2}
                y={node.y}
                width={node.width}
                height={node.height}
                rx={6}
                fill={node.color}
                opacity={rectOpacity}
                style={{ transition: "opacity 120ms ease" }}
              />

              {/* Layer label ABOVE the rect */}
              <text
                x={node.x}
                y={node.y - 8}
                textAnchor="middle"
                fill={tokenColor.text0}
                fontSize={font.size.md}
                fontWeight={font.weight.bold}
                fontFamily={font.sans}
              >
                {node.label}
              </text>

              {/* File count BELOW the rect */}
              <text
                x={node.x}
                y={node.y + node.height + 14}
                textAnchor="middle"
                fill={tokenColor.text2}
                fontSize={font.size.xs}
                fontFamily={font.sans}
              >
                {node.fileCount} files
              </text>
            </g>
          );
        })}

        {/* ── Background title (top-left) ───────────────────────────────── */}
        <text
          x={16}
          y={20}
          fill={tokenColor.text0}
          fontSize={font.size.xl}
          fontWeight={font.weight.semibold}
          fontFamily={font.sans}
        >
          Architecture Layer Flow
        </text>
        <text
          x={16}
          y={38}
          fontSize={font.size.sm}
          fontFamily={font.sans}
        >
          <tspan
            fill={layout.totalViolations > 0 ? VIOLATION_COLOR : tokenColor.text2}
          >
            {layout.totalViolations} violations
          </tspan>
          <tspan fill={tokenColor.text2}>{" · "}</tspan>
          <tspan fill={tokenColor.text2}>{layout.totalAllowed} allowed edges</tspan>
        </text>

        {/* ── Violation summary (right side) ───────────────────────────── */}
        {layout.totalViolations > 0 && (
          <g>
            <text
              x={width - VIOLATION_SUMMARY_X_OFFSET}
              y={20}
              fill={VIOLATION_COLOR}
              fontSize={font.size.xs}
              fontWeight={font.weight.semibold}
              fontFamily={font.sans}
            >
              Illegal dependencies:
            </text>
            {layout.violatingPairs.slice(0, MAX_VIOLATION_PAIRS_SHOWN).map((pair, i) => (
              <text
                key={`${pair.fromLayer}-${pair.toLayer}`}
                x={width - VIOLATION_SUMMARY_X_OFFSET}
                y={34 + i * 14}
                fill={VIOLATION_COLOR}
                fontSize={font.size.xs}
                fontFamily={font.sans}
              >
                {pair.fromLayer} → {pair.toLayer}: {pair.count} edges
              </text>
            ))}
          </g>
        )}

        {/* ── Tooltip ───────────────────────────────────────────────────── */}
        {tooltip && (
          <g>
            <rect
              x={tooltip.x - 4}
              y={tooltip.y - 2}
              width={tooltip.text.length * 6.5 + 8}
              height={TOOLTIP_H}
              rx={4}
              fill={tokenColor.text0}
              opacity={0.85}
            />
            <text
              x={tooltip.x}
              y={tooltip.y + TOOLTIP_H / 2 - 1}
              fill={tokenColor.bg0}
              fontSize={font.size.xs}
              fontFamily={font.sans}
              dominantBaseline="middle"
            >
              {tooltip.text}
            </text>
          </g>
        )}
      </g>
    </svg>
  );
}

export const ArchLayerView = memo(ArchLayerViewImpl);
