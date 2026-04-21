// ServiceTopoView — SVG renderer for the Service Topology diagram.
// --------------------------------------------------------------------
// Renders each package as a circle with internal-metrics ring, connected
// by bezier arrows showing cross-package dependency flow.
//
// Z-order (bottom to top):
//   1. Backdrop (click → onDismiss)
//   2. Service edges (bezier curves with arrowheads)
//   3. Edge weight labels (mid-path)
//   4. Service node circles (with inner ring segments)
//   5. Service node labels (name + stats + layer badge)
//   6. Hover tooltip (SVG-inline, clamped)
//   7. Title + subtitle (top-left)
//   8. Legend (bottom-right: edge kinds + layer colors)

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { WorkspaceGraph } from "@quanta/canvas-engine";
import { color as tokenColor, font } from "../../../shared/ui/tokens";
import { buildServiceTopoLayout } from "../model/build-service-topo-layout";
import type { ServiceEdge, ServiceNode } from "../model/types";

export interface ServiceTopoViewProps {
  graph: WorkspaceGraph;
  onFocusEntity?: (id: string) => void;
  onDismiss?: () => void;
}

// ── Constants ─────────────────────────────────────────────────────────
const ENTRY_MS = 280;
const TOOLTIP_W = 192;
const TOOLTIP_H = 60;
const TOOLTIP_PAD = 8;
const TOOLTIP_R = 4;
const ARROW_SIZE = 8;

// ── Helpers ───────────────────────────────────────────────────────────

function hexWithAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function kLoc(loc: number): string {
  if (loc < 1000) return `${loc}`;
  return `${(loc / 1000).toFixed(1)}k`;
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}

/** Stroke width for edge proportional to log(weight+1) * 3, clamped 1..10 */
function edgeStrokeWidth(weight: number): number {
  return Math.max(1, Math.min(10, Math.log(weight + 1) * 3));
}

/**
 * Compute the midpoint of a cubic bezier at t=0.5.
 * The path is "M sx sy C c1x c1y, c2x c2y, ex ey"
 */
function bezierMidpoint(path: string): { x: number; y: number } | null {
  const nums = path.match(/[-\d.]+/g);
  if (!nums || nums.length < 8) return null;
  const [sx, sy, c1x, c1y, c2x, c2y, ex, ey] = nums.map(Number) as [
    number, number, number, number, number, number, number, number
  ];
  // de Casteljau at t=0.5
  const t = 0.5;
  const mt = 1 - t;
  const x =
    mt * mt * mt * sx +
    3 * mt * mt * t * c1x +
    3 * mt * t * t * c2x +
    t * t * t * ex;
  const y =
    mt * mt * mt * sy +
    3 * mt * mt * t * c1y +
    3 * mt * t * t * c2y +
    t * t * t * ey;
  return { x, y };
}

// ── Arc ring segment (layer breakdown) ───────────────────────────────

const LAYER_COLORS_CSS: Record<string, string> = {
  domain:  "#7e4ed6",
  adapter: "#0d99ff",
  ui:      "#22a06b",
  infra:   "#e09321",
  util:    "#a0a0a5",
  unknown: "#cdcdcd",
};

interface ArcSegmentProps {
  cx: number; cy: number;
  outerR: number; innerR: number;
  startAngle: number; endAngle: number;
  color: string;
  opacity: number;
}

function ArcSegment({ cx, cy, outerR, innerR, startAngle, endAngle, color, opacity }: ArcSegmentProps) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const sa = toRad(startAngle);
  const ea = toRad(endAngle);
  const x1 = cx + outerR * Math.cos(sa);
  const y1 = cy + outerR * Math.sin(sa);
  const x2 = cx + outerR * Math.cos(ea);
  const y2 = cy + outerR * Math.sin(ea);
  const x3 = cx + innerR * Math.cos(ea);
  const y3 = cy + innerR * Math.sin(ea);
  const x4 = cx + innerR * Math.cos(sa);
  const y4 = cy + innerR * Math.sin(sa);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  const d = [
    `M ${x1.toFixed(2)} ${y1.toFixed(2)}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
    `L ${x3.toFixed(2)} ${y3.toFixed(2)}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4.toFixed(2)} ${y4.toFixed(2)}`,
    "Z",
  ].join(" ");
  return <path d={d} fill={color} opacity={opacity} style={{ pointerEvents: "none" }} />;
}

// ── Main component ────────────────────────────────────────────────────

function ServiceTopoViewImpl({
  graph,
  onFocusEntity: _onFocusEntity,
  onDismiss,
}: ServiceTopoViewProps) {
  const [mounted, setMounted] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);
  const [dims, setDims] = useState({ w: 800, h: 600 });

  useEffect(() => {
    let r1 = 0;
    let r2 = 0;
    r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => setMounted(true));
    });
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
  }, []);

  const layout = useMemo(
    () => buildServiceTopoLayout({ graph, width: dims.w, height: dims.h }),
    [graph, dims.w, dims.h],
  );

  const nodeById = useMemo(() => {
    const m = new Map<string, ServiceNode>();
    for (const n of layout.nodes) m.set(n.graphId, n);
    return m;
  }, [layout.nodes]);

  const handleBackdrop = useCallback(() => onDismiss?.(), [onDismiss]);

  const edgeKey = (e: ServiceEdge) => `${e.from}→${e.to}`;

  // Tooltip for hovered edge
  const hoveredEdgeObj = hoveredEdge
    ? layout.edges.find(e => edgeKey(e) === hoveredEdge) ?? null
    : null;

  // Tooltip for hovered node
  const hoveredNodeObj = hoveredNode ? nodeById.get(hoveredNode) ?? null : null;

  function nodeTooltipPos(n: ServiceNode): { tx: number; ty: number } {
    const margin = 8;
    let tx = n.x - TOOLTIP_W / 2;
    let ty = n.y - n.radius - TOOLTIP_H - 12;
    if (tx < margin) tx = margin;
    if (tx + TOOLTIP_W > dims.w - margin) tx = dims.w - margin - TOOLTIP_W;
    if (ty < margin) ty = n.y + n.radius + 12;
    return { tx, ty };
  }

  function edgeTooltipPos(e: ServiceEdge): { tx: number; ty: number } {
    const mid = bezierMidpoint(e.path);
    const margin = 8;
    const bx = mid ? mid.x : dims.w / 2;
    const by = mid ? mid.y : dims.h / 2;
    let tx = bx - TOOLTIP_W / 2;
    let ty = by - TOOLTIP_H / 2 - 24;
    if (tx < margin) tx = margin;
    if (tx + TOOLTIP_W > dims.w - margin) tx = dims.w - margin - TOOLTIP_W;
    if (ty < margin) ty = by + 16;
    return { tx, ty };
  }

  const rootStyle: CSSProperties = {
    position: "relative",
    width: "100%",
    height: "100%",
    overflow: "hidden",
  };

  const svgStyle: CSSProperties = {
    display: "block",
    userSelect: "none",
    opacity: mounted ? 1 : 0,
    transition: `opacity ${ENTRY_MS}ms ease-out`,
  };

  return (
    <div
      style={rootStyle}
      ref={(el) => {
        if (el) {
          const { width, height } = el.getBoundingClientRect();
          if (width > 0 && height > 0 && (width !== dims.w || height !== dims.h)) {
            setDims({ w: Math.floor(width), h: Math.floor(height) });
          }
        }
      }}
    >
      {/* Arrowhead defs */}
      <svg width={0} height={0} style={{ position: "absolute" }}>
        <defs>
          {["rpc", "api-call", "queue", "shared-db"].map(kind => {
            const c = kind === "rpc"
              ? "#0d99ff"
              : kind === "api-call"
              ? "#22a06b"
              : kind === "queue"
              ? "#e09321"
              : "#7e4ed6";
            return (
              <marker
                key={`arrow-${kind}`}
                id={`arrow-${kind}`}
                markerWidth={ARROW_SIZE}
                markerHeight={ARROW_SIZE}
                refX={ARROW_SIZE - 2}
                refY={ARROW_SIZE / 2}
                orient="auto"
              >
                <path
                  d={`M 0 0 L ${ARROW_SIZE} ${ARROW_SIZE / 2} L 0 ${ARROW_SIZE} Z`}
                  fill={c}
                />
              </marker>
            );
          })}
        </defs>
      </svg>

      <svg
        width={dims.w}
        height={dims.h}
        viewBox={`0 0 ${dims.w} ${dims.h}`}
        style={svgStyle}
        role="img"
        aria-label="Service Topology — inter-package dependency map"
      >
        {/* 1. Backdrop */}
        <rect
          x={0} y={0} width={dims.w} height={dims.h}
          fill="transparent"
          onClick={handleBackdrop}
          style={{ cursor: onDismiss ? "default" : "inherit" }}
        />

        {/* 2. Service edges */}
        {layout.edges.map(e => {
          const ek = edgeKey(e);
          const isHovered = hoveredEdge === ek;
          const nodeActive = hoveredNode === e.from || hoveredNode === e.to;
          const dimmed = (hoveredEdge !== null && !isHovered && !nodeActive)
            || (hoveredNode !== null && !nodeActive);
          const sw = edgeStrokeWidth(e.weight);
          const opacity = dimmed ? 0.12 : isHovered || nodeActive ? 1 : 0.65;

          return (
            <g
              key={ek}
              onMouseEnter={() => setHoveredEdge(ek)}
              onMouseLeave={() => setHoveredEdge(null)}
              style={{ cursor: "crosshair" }}
            >
              {/* Wide transparent hit target */}
              <path
                d={e.path}
                fill="none"
                stroke="transparent"
                strokeWidth={Math.max(16, sw + 12)}
              />
              <path
                d={e.path}
                fill="none"
                stroke={e.color}
                strokeWidth={sw}
                opacity={opacity}
                strokeLinecap="round"
                markerEnd={`url(#arrow-${e.kind})`}
                style={{ transition: "opacity 120ms" }}
              />
            </g>
          );
        })}

        {/* 3. Edge weight labels */}
        {layout.edges.map(e => {
          const ek = edgeKey(e);
          const mid = bezierMidpoint(e.path);
          if (!mid) return null;
          const isActive = hoveredEdge === ek || hoveredNode === e.from || hoveredNode === e.to;
          const dimmed = (hoveredEdge !== null || hoveredNode !== null) && !isActive;
          return (
            <g key={`label-${ek}`} style={{ pointerEvents: "none" }}>
              <rect
                x={mid.x - 14}
                y={mid.y - 9}
                width={28}
                height={16}
                rx={3}
                fill={tokenColor.bg0}
                opacity={dimmed ? 0.4 : 0.85}
              />
              <text
                x={mid.x}
                y={mid.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontFamily={font.sans}
                fontSize={font.size.xs}
                fontWeight={font.weight.medium}
                fill={e.color}
                opacity={dimmed ? 0.4 : 1}
                style={{ transition: "opacity 120ms" }}
              >
                {e.weight}
              </text>
            </g>
          );
        })}

        {/* 4. Service node circles + ring segments */}
        {layout.nodes.map(n => {
          const isHovered = hoveredNode === n.graphId;
          const edgeActive = layout.edges.some(
            e => hoveredEdge === edgeKey(e) && (e.from === n.graphId || e.to === n.graphId),
          );
          const dimmed = (hoveredNode !== null && !isHovered) && !edgeActive;
          const opacity = dimmed ? 0.2 : 1;

          // Build arc segments for layer breakdown
          const breakdown = n.layerBreakdown;
          const entries = Object.entries(breakdown) as [string, number][];
          // Sort stably by layer name
          entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

          let currentAngle = -90; // start at top
          const ringOuter = n.radius + 8;
          const ringInner = n.radius + 3;

          return (
            <g
              key={`node-${n.graphId}`}
              onMouseEnter={() => setHoveredNode(n.graphId)}
              onMouseLeave={() => setHoveredNode(null)}
              style={{ cursor: "default" }}
            >
              {/* Glow ring when hovered */}
              {isHovered && (
                <circle
                  cx={n.x} cy={n.y} r={n.radius + 14}
                  fill={hexWithAlpha(n.color, 0.08)}
                  style={{ pointerEvents: "none" }}
                />
              )}

              {/* Main node circle */}
              <circle
                cx={n.x} cy={n.y} r={n.radius}
                fill={hexWithAlpha(n.color, isHovered ? 0.18 : 0.10)}
                stroke={n.color}
                strokeWidth={isHovered ? 2.5 : 1.5}
                opacity={opacity}
                style={{ transition: "opacity 120ms, stroke-width 120ms" }}
              />

              {/* Layer breakdown ring arc segments */}
              {entries.map(([layer, frac]) => {
                const sweep = frac * 360;
                if (sweep < 2) return null;
                const seg = (
                  <ArcSegment
                    key={`arc-${n.graphId}-${layer}`}
                    cx={n.x} cy={n.y}
                    outerR={ringOuter} innerR={ringInner}
                    startAngle={currentAngle}
                    endAngle={currentAngle + sweep}
                    color={LAYER_COLORS_CSS[layer] ?? "#cdcdcd"}
                    opacity={dimmed ? 0.15 : 0.75}
                  />
                );
                currentAngle += sweep;
                return seg;
              })}
            </g>
          );
        })}

        {/* 5. Service node labels */}
        {layout.nodes.map(n => {
          const isHovered = hoveredNode === n.graphId;
          const edgeActive = layout.edges.some(
            e => hoveredEdge === edgeKey(e) && (e.from === n.graphId || e.to === n.graphId),
          );
          const dimmed = (hoveredNode !== null && !isHovered) && !edgeActive;
          const opacity = dimmed ? 0.2 : 1;

          const labelY = n.y + n.radius + 16;

          return (
            <g
              key={`labels-${n.graphId}`}
              onMouseEnter={() => setHoveredNode(n.graphId)}
              onMouseLeave={() => setHoveredNode(null)}
              style={{ cursor: "default" }}
            >
              {/* Service name inside circle */}
              <text
                x={n.x} y={n.y - 6}
                textAnchor="middle"
                dominantBaseline="central"
                fontFamily={font.sans}
                fontSize={Math.min(font.size.sm, n.radius * 0.32)}
                fontWeight={font.weight.semibold}
                fill={n.color}
                opacity={opacity}
                style={{ pointerEvents: "none", userSelect: "none", transition: "opacity 120ms" }}
              >
                {truncate(n.label, 14)}
              </text>

              {/* File count below name inside circle */}
              <text
                x={n.x} y={n.y + 10}
                textAnchor="middle"
                dominantBaseline="central"
                fontFamily={font.sans}
                fontSize={font.size.xs}
                fill={tokenColor.text2}
                opacity={opacity}
                style={{ pointerEvents: "none", userSelect: "none", transition: "opacity 120ms" }}
              >
                {n.fileCount} files · {kLoc(n.loc)} LoC
              </text>

              {/* Layer badge below circle */}
              <rect
                x={n.x - 26} y={labelY - 1}
                width={52} height={14}
                rx={7}
                fill={hexWithAlpha(n.color, 0.12)}
                opacity={opacity}
                style={{ pointerEvents: "none" }}
              />
              <text
                x={n.x} y={labelY + 6}
                textAnchor="middle"
                dominantBaseline="central"
                fontFamily={font.sans}
                fontSize={font.size.xxs}
                fontWeight={font.weight.medium}
                fill={n.color}
                opacity={opacity}
                style={{ pointerEvents: "none", userSelect: "none", transition: "opacity 120ms" }}
              >
                {n.archLayer}
              </text>
            </g>
          );
        })}

        {/* 6. Tooltips */}
        {hoveredNodeObj && (() => {
          const { tx, ty } = nodeTooltipPos(hoveredNodeObj);
          return (
            <g style={{ pointerEvents: "none" }}>
              <rect x={tx} y={ty} width={TOOLTIP_W} height={TOOLTIP_H}
                rx={TOOLTIP_R} fill={tokenColor.bg0} stroke={tokenColor.border}
                strokeWidth={1} filter="drop-shadow(0 2px 6px rgba(0,0,0,0.10))" />
              <text x={tx + TOOLTIP_PAD} y={ty + TOOLTIP_PAD + 2}
                dominantBaseline="hanging" fontFamily={font.sans}
                fontSize={font.size.md} fontWeight={font.weight.semibold}
                fill={tokenColor.text0}>
                {truncate(hoveredNodeObj.label, 22)}
              </text>
              <text x={tx + TOOLTIP_PAD} y={ty + TOOLTIP_PAD + 19}
                dominantBaseline="hanging" fontFamily={font.sans}
                fontSize={font.size.xs} fill={tokenColor.text2}>
                {hoveredNodeObj.fileCount} files · {kLoc(hoveredNodeObj.loc)} LoC
              </text>
              <text x={tx + TOOLTIP_PAD} y={ty + TOOLTIP_PAD + 34}
                dominantBaseline="hanging" fontFamily={font.sans}
                fontSize={font.size.xs}
                fill={
                  hoveredNodeObj.riskScore >= 70
                    ? tokenColor.danger
                    : hoveredNodeObj.riskScore >= 40
                    ? tokenColor.warn
                    : tokenColor.success
                }>
                avg risk {hoveredNodeObj.riskScore.toFixed(1)}
              </text>
            </g>
          );
        })()}

        {hoveredEdgeObj && !hoveredNodeObj && (() => {
          const { tx, ty } = edgeTooltipPos(hoveredEdgeObj);
          const fromLabel = nodeById.get(hoveredEdgeObj.from)?.label ?? hoveredEdgeObj.from;
          const toLabel   = nodeById.get(hoveredEdgeObj.to)?.label   ?? hoveredEdgeObj.to;
          return (
            <g style={{ pointerEvents: "none" }}>
              <rect x={tx} y={ty} width={TOOLTIP_W} height={TOOLTIP_H}
                rx={TOOLTIP_R} fill={tokenColor.bg0} stroke={tokenColor.border}
                strokeWidth={1} filter="drop-shadow(0 2px 6px rgba(0,0,0,0.10))" />
              <text x={tx + TOOLTIP_PAD} y={ty + TOOLTIP_PAD + 2}
                dominantBaseline="hanging" fontFamily={font.sans}
                fontSize={font.size.xs} fontWeight={font.weight.semibold}
                fill={hoveredEdgeObj.color}>
                {hoveredEdgeObj.kind}
              </text>
              <text x={tx + TOOLTIP_PAD} y={ty + TOOLTIP_PAD + 18}
                dominantBaseline="hanging" fontFamily={font.sans}
                fontSize={font.size.xs} fill={tokenColor.text1}>
                {truncate(fromLabel, 14)} → {truncate(toLabel, 14)}
              </text>
              <text x={tx + TOOLTIP_PAD} y={ty + TOOLTIP_PAD + 34}
                dominantBaseline="hanging" fontFamily={font.sans}
                fontSize={font.size.xs} fill={tokenColor.text2}>
                total weight {hoveredEdgeObj.weight}
              </text>
            </g>
          );
        })()}

        {/* 7. Title + subtitle */}
        <g style={{ pointerEvents: "none" }}>
          <text x={16} y={18} dominantBaseline="hanging"
            fontFamily={font.sans} fontSize={font.size.md}
            fontWeight={font.weight.semibold} fill={tokenColor.text0}>
            Service Topology
          </text>
          <text x={16} y={36} dominantBaseline="hanging"
            fontFamily={font.sans} fontSize={font.size.xs} fill={tokenColor.text2}>
            inter-package dependency map
          </text>
        </g>

        {/* 8. Legend (bottom-right) */}
        <g style={{ pointerEvents: "none" }}>
          {/* Edge kind legend */}
          {(
            [
              ["rpc",       "#0d99ff", "RPC"],
              ["api-call",  "#22a06b", "API call"],
            ] as [string, string, string][]
          ).map(([, color, label], i) => (
            <g key={label} transform={`translate(${dims.w - 96}, ${dims.h - 54 + i * 18})`}>
              <line x1={0} y1={6} x2={16} y2={6}
                stroke={color} strokeWidth={2} strokeLinecap="round" />
              <text x={22} y={10} dominantBaseline="hanging"
                fontFamily={font.sans} fontSize={font.size.xs} fill={tokenColor.text2}>
                {label}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}

export const ServiceTopoView = memo(ServiceTopoViewImpl);
