// ServiceTopoView — SVG renderer for the Service Topology diagram.
// --------------------------------------------------------------------
// Renders each package as a circle with internal-metrics ring, connected
// by bezier arrows showing cross-package dependency flow.
//
// Z-order (bottom to top):
//   1. Backdrop (click → onDismiss)
//   2. Service edges (bezier, animated dashes on hover/active)
//   3. Traffic packets (animateMotion dots on each edge)
//   4. Edge weight label chips (mid-bezier, shown when weight > 3 or hover)
//   5. Service node circles + health ring + elevation shadow
//   6. Health pulse rings (animated expand/fade)
//   7. Layer donut ring arc segments (thicker, 6px, with glow)
//   8. Lock icon for high-complexity nodes (fileCount > 20)
//   9. Service node labels (name + stats + health score + layer badge)
//  10. Header (title, subtitle, dismiss ×, right chip)
//  11. Legend panel bottom-right (edge types + layers)
//  12. (Empty state handled inline)

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { WorkspaceGraph } from "@quanta/canvas-engine";
import {
  color as tokenColor,
  font,
  radius as tokenRadius,
  transition,
} from "../../../shared/ui/tokens";
import { buildServiceTopoLayout } from "../model/build-service-topo-layout";
import type { ServiceEdge, ServiceNode } from "../model/types";

export interface ServiceTopoViewProps {
  graph: WorkspaceGraph;
  onFocusEntity?: (id: string) => void;
  onDismiss?: () => void;
}

// ── Constants ─────────────────────────────────────────────────────────
const ENTRY_MS = 250;
const NODE_STAGGER_MS = 100;
const EDGE_APPEAR_DELAY = 300;
const ARROW_SIZE = 8;
const HIGH_COMPLEXITY_THRESHOLD = 20;

// Layer colors matching LAYER_COLORS_CSS + edge kind colors
const LAYER_COLORS: Record<string, string> = {
  domain:  "#7e4ed6",
  adapter: "#0d99ff",
  ui:      "#22a06b",
  infra:   "#e09321",
  util:    "#a0a0a5",
  unknown: "#cdcdcd",
};

const EDGE_KIND_COLORS: Record<string, string> = {
  "api-call":  "#22a06b",
  "rpc":       "#0d99ff",
  "queue":     "#e09321",
  "shared-db": "#7e4ed6",
};

// ── Helpers ───────────────────────────────────────────────────────────

function hexWithAlpha(hex: string, alpha: number): string {
  const clean = hex.startsWith("#") ? hex.slice(1) : hex;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return hex;
  return `rgba(${r},${g},${b},${alpha})`;
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}

function kLoc(loc: number): string {
  if (loc < 1000) return `${loc}`;
  return `${(loc / 1000).toFixed(1)}k`;
}

function edgeStrokeWidth(weight: number): number {
  return Math.max(1, Math.min(10, Math.log(weight + 1) * 3));
}

/** Compute midpoint of a cubic bezier at t=0.5 via de Casteljau. */
function bezierMidpoint(path: string): { x: number; y: number } | null {
  const nums = path.match(/[-\d.]+/g);
  if (!nums || nums.length < 8) return null;
  const [sx, sy, c1x, c1y, c2x, c2y, ex, ey] = nums.map(Number) as [
    number, number, number, number, number, number, number, number
  ];
  const t = 0.5, mt = 1 - t;
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

/** Approximate arc length of a cubic bezier by sampling 20 segments. */
function bezierApproxLength(path: string): number {
  const nums = path.match(/[-\d.]+/g);
  if (!nums || nums.length < 8) return 100;
  const [sx, sy, c1x, c1y, c2x, c2y, ex, ey] = nums.map(Number) as [
    number, number, number, number, number, number, number, number
  ];
  let len = 0;
  let px = sx, py = sy;
  const N = 20;
  for (let i = 1; i <= N; i++) {
    const t = i / N, mt = 1 - t;
    const x = mt*mt*mt*sx + 3*mt*mt*t*c1x + 3*mt*t*t*c2x + t*t*t*ex;
    const y = mt*mt*mt*sy + 3*mt*mt*t*c1y + 3*mt*t*t*c2y + t*t*t*ey;
    len += Math.hypot(x - px, y - py);
    px = x; py = y;
  }
  return len;
}

/** Health score 0-100 from avgRisk */
function healthScore(riskScore: number): number {
  return Math.round(Math.max(0, Math.min(100, 100 - riskScore)));
}

/** Health score → color: green ≥80, amber ≥60, red otherwise */
function healthColor(score: number): string {
  if (score >= 80) return "#22a06b";
  if (score >= 60) return "#e09321";
  return "#ef4444";
}

/** SVG arc path for a ring segment (donut slice). */
function arcPath(
  cx: number, cy: number,
  outerR: number, innerR: number,
  startDeg: number, endDeg: number,
): string {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const sa = toRad(startDeg), ea = toRad(endDeg);
  const x1 = cx + outerR * Math.cos(sa);
  const y1 = cy + outerR * Math.sin(sa);
  const x2 = cx + outerR * Math.cos(ea);
  const y2 = cy + outerR * Math.sin(ea);
  const x3 = cx + innerR * Math.cos(ea);
  const y3 = cy + innerR * Math.sin(ea);
  const x4 = cx + innerR * Math.cos(sa);
  const y4 = cy + innerR * Math.sin(sa);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return [
    `M ${x1.toFixed(2)} ${y1.toFixed(2)}`,
    `A ${outerR} ${outerR} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`,
    `L ${x3.toFixed(2)} ${y3.toFixed(2)}`,
    `A ${innerR} ${innerR} 0 ${large} 0 ${x4.toFixed(2)} ${y4.toFixed(2)}`,
    "Z",
  ].join(" ");
}

/** Derive a stable edge ID from from/to/kind */
function edgeId(e: ServiceEdge): string {
  return `${e.from}→${e.to}→${e.kind}`;
}

// ── Inject once-per-lifetime keyframes ───────────────────────────────

function injectKeyframes(): void {
  const id = "service-topo-kf";
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `
    @keyframes stFadeUp {
      from { opacity: 0; transform: scale(0.5); }
      to   { opacity: 1; transform: scale(1); }
    }
    @keyframes stFadeIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
  `;
  document.head.appendChild(style);
}

// ── Arc segment component ─────────────────────────────────────────────

interface ArcSegmentProps {
  cx: number; cy: number;
  outerR: number; innerR: number;
  startAngle: number; endAngle: number;
  color: string;
  opacity: number;
  glow?: boolean;
}

function ArcSegment({
  cx, cy, outerR, innerR, startAngle, endAngle, color, opacity, glow,
}: ArcSegmentProps) {
  const d = arcPath(cx, cy, outerR, innerR, startAngle, endAngle);
  return (
    <path
      d={d}
      fill={color}
      opacity={opacity}
      style={{
        pointerEvents: "none",
        filter: glow ? `drop-shadow(0 0 3px ${color})` : undefined,
      }}
    />
  );
}

// ── Health ring arc ───────────────────────────────────────────────────

interface HealthRingProps {
  cx: number; cy: number; r: number;
  score: number;
  color: string;
  opacity: number;
}

function HealthRing({ cx, cy, r, score, color, opacity }: HealthRingProps) {
  if (score <= 0) return null;
  const sweep = score * 3.6;
  const startDeg = -90;
  const endDeg = startDeg + sweep;
  const ringOuter = r + 16;
  const ringInner = r + 12;
  const d = arcPath(cx, cy, ringOuter, ringInner, startDeg, endDeg);
  return (
    <path
      d={d}
      fill={color}
      opacity={opacity}
      style={{ pointerEvents: "none" }}
    />
  );
}

// ── Health pulse ring ─────────────────────────────────────────────────

interface HealthPulseRingProps {
  cx: number;
  cy: number;
  nodeRadius: number;
  score: number;
}

function HealthPulseRing({ cx, cy, nodeRadius, score }: HealthPulseRingProps) {
  const hColor = healthColor(score);
  const r0 = nodeRadius + 4;
  const r1 = nodeRadius + 12;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={r0}
      fill="none"
      stroke={hColor}
      strokeWidth={1.5}
      style={{ pointerEvents: "none" }}
    >
      <animate
        attributeName="r"
        values={`${r0};${r1};${r0}`}
        dur="2.5s"
        repeatCount="indefinite"
      />
      <animate
        attributeName="opacity"
        values="0.7;0;0.7"
        dur="2.5s"
        repeatCount="indefinite"
      />
    </circle>
  );
}

// ── Lock icon for high-complexity nodes ───────────────────────────────

interface LockIconProps {
  cx: number;
  cy: number;
  nodeRadius: number;
}

function LockIcon({ cx, cy, nodeRadius }: LockIconProps) {
  // Position at top-right of the circle
  const iconX = cx + nodeRadius * 0.65;
  const iconY = cy - nodeRadius * 0.65;
  const s = 7; // icon size

  // Simple padlock SVG path centered at (0,0), scaled to s
  // Body: rounded rect; Shackle: arc above
  return (
    <g
      transform={`translate(${iconX}, ${iconY})`}
      style={{ pointerEvents: "none" }}
    >
      {/* Background circle */}
      <circle cx={0} cy={0} r={s} fill="rgba(0,0,0,0.55)" />
      {/* Shackle arc */}
      <path
        d={`M ${-s * 0.35} ${-s * 0.05} A ${s * 0.35} ${s * 0.45} 0 0 1 ${s * 0.35} ${-s * 0.05}`}
        fill="none"
        stroke="#e09321"
        strokeWidth={1.4}
        strokeLinecap="round"
      />
      {/* Body rect */}
      <rect
        x={-s * 0.42}
        y={-s * 0.05}
        width={s * 0.84}
        height={s * 0.6}
        rx={1.5}
        fill="#e09321"
      />
      {/* Keyhole */}
      <circle cx={0} cy={s * 0.2} r={1.2} fill="rgba(0,0,0,0.6)" />
    </g>
  );
}

// ── Main component ────────────────────────────────────────────────────

function ServiceTopoViewImpl({
  graph,
  onFocusEntity,
  onDismiss,
}: ServiceTopoViewProps) {
  const [mounted, setMounted] = useState(false);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [dims, setDims] = useState({ w: 800, h: 600 });

  useEffect(() => {
    injectKeyframes();
    let r1 = 0, r2 = 0;
    r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => setMounted(true));
    });
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
  }, []);

  const layout = useMemo(
    () => buildServiceTopoLayout({ graph, width: dims.w, height: dims.h }),
    [graph, dims.w, dims.h],
  );

  const handleBackdrop = useCallback(() => {
    setSelectedNode(null);
    onDismiss?.();
  }, [onDismiss]);

  const handleNodeClick = useCallback((n: ServiceNode) => {
    setSelectedNode((prev) => (prev === n.graphId ? null : n.graphId));
    onFocusEntity?.(n.graphId);
  }, [onFocusEntity]);

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
    transform: mounted ? "translateY(0)" : "translateY(6px)",
    transition: `opacity ${ENTRY_MS}ms ease-out, transform ${ENTRY_MS}ms ease-out`,
  };

  const totalFiles = layout.totalFiles;

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
      {/* Arrowhead defs + filter defs */}
      <svg width={0} height={0} style={{ position: "absolute" }}>
        <defs>
          {(["rpc", "api-call", "queue", "shared-db"] as const).map((kind) => {
            const c = EDGE_KIND_COLORS[kind] ?? "#888";
            return (
              <marker
                key={`arrow-${kind}`}
                id={`st-arrow-${kind}`}
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
          fill={tokenColor.bg1}
          onClick={handleBackdrop}
          style={{ cursor: "default" }}
        />

        {/* 2. Service edges */}
        {layout.edges.map((e, ei) => {
          const ek = edgeId(e);
          const isHoveredEdge = hoveredEdge === ek;
          const isConnectedToHoveredNode =
            hoveredNodeId === e.from || hoveredNodeId === e.to;
          const isConnectedToSelectedNode =
            selectedNode === e.from || selectedNode === e.to;
          const isActive = isHoveredEdge || isConnectedToHoveredNode || isConnectedToSelectedNode;

          // Connected-to-hovered: full color + thicker
          // Non-connected when any node hovered: very dim
          let edgeStrokeOpacity: number;
          let edgeStrokeColor: string;
          let edgeSW = edgeStrokeWidth(e.weight);

          if (hoveredNodeId !== null) {
            if (isConnectedToHoveredNode) {
              edgeStrokeOpacity = 0.9;
              edgeStrokeColor = e.color;
              edgeSW = edgeStrokeWidth(e.weight) * 1.5;
            } else {
              edgeStrokeOpacity = 0.1;
              edgeStrokeColor = e.color;
            }
          } else {
            const dimmed =
              (hoveredEdge !== null && !isHoveredEdge) ||
              (selectedNode !== null && !isConnectedToSelectedNode);
            edgeStrokeOpacity = dimmed ? 0.1 : isActive ? 1 : 0.55;
            edgeStrokeColor = e.color;
          }

          const totalLen = bezierApproxLength(e.path);
          const dashArray = "8 4";
          const pathId = `edge-path-${ek.replace(/[^a-z0-9]/gi, "_")}`;

          return (
            <g
              key={ek}
              onMouseEnter={() => setHoveredEdge(ek)}
              onMouseLeave={() => setHoveredEdge(null)}
              style={{
                cursor: "crosshair",
                opacity: mounted ? edgeStrokeOpacity : 0,
                transition: `opacity 150ms ease-out`,
                animation: mounted
                  ? `stFadeIn ${ENTRY_MS}ms ${EDGE_APPEAR_DELAY + ei * 40}ms ease-out both`
                  : undefined,
              }}
            >
              {/* Wide transparent hit target */}
              <path
                d={e.path}
                fill="none"
                stroke="transparent"
                strokeWidth={Math.max(16, edgeSW + 12)}
              />

              {/* Named bezier path (used by animateMotion) */}
              <path
                id={pathId}
                d={e.path}
                fill="none"
                stroke={edgeStrokeColor}
                strokeWidth={edgeSW}
                strokeLinecap="round"
                strokeDasharray={dashArray}
                markerEnd={`url(#st-arrow-${e.kind})`}
              />

              {/* Animated flow on active edges */}
              {isActive && (
                <path
                  d={e.path}
                  fill="none"
                  stroke={edgeStrokeColor}
                  strokeWidth={edgeSW}
                  strokeLinecap="round"
                  strokeDasharray={dashArray}
                  markerEnd={`url(#st-arrow-${e.kind})`}
                >
                  <animate
                    attributeName="stroke-dashoffset"
                    from={`${totalLen}`}
                    to="0"
                    dur="2s"
                    repeatCount="indefinite"
                  />
                </path>
              )}
            </g>
          );
        })}

        {/* 3. Traffic packet dots traveling along each edge */}
        {layout.edges.map((e, ei) => {
          const ek = edgeId(e);
          const pathId = `edge-path-${ek.replace(/[^a-z0-9]/gi, "_")}`;
          const packetColor = e.color;
          const dur = `${(2.5 + e.weight * 0.3).toFixed(2)}s`;
          const begin = `${((ei * 0.7) % 3).toFixed(2)}s`;

          return (
            <circle
              key={`packet-${ek}`}
              r={4}
              fill={packetColor}
              style={{
                filter: `drop-shadow(0 0 3px ${packetColor})`,
                pointerEvents: "none",
                opacity: mounted ? 0.85 : 0,
              }}
            >
              <animateMotion
                dur={dur}
                begin={begin}
                repeatCount="indefinite"
              >
                <mpath href={`#${pathId}`} />
              </animateMotion>
            </circle>
          );
        })}

        {/* 4. Edge weight / dep label chips (mid-bezier) */}
        {layout.edges.map((e) => {
          const ek = edgeId(e);
          const mid = bezierMidpoint(e.path);
          if (!mid) return null;
          const isConnectedToHoveredNode =
            hoveredNodeId === e.from || hoveredNodeId === e.to;
          const isActive =
            hoveredEdge === ek ||
            isConnectedToHoveredNode ||
            selectedNode === e.from ||
            selectedNode === e.to;
          const show = e.weight > 3 || isActive;
          if (!show) return null;

          const dimmed =
            (hoveredEdge !== null || hoveredNodeId !== null || selectedNode !== null) && !isActive;
          const label = `${e.weight} deps`;
          const chipW = label.length * 5.5 + 10;
          const chipH = 14;

          return (
            <g key={`elabel-${ek}`} style={{ pointerEvents: "none" }}>
              <rect
                x={mid.x - chipW / 2}
                y={mid.y - chipH / 2}
                width={chipW}
                height={chipH}
                rx={tokenRadius.sm}
                fill={tokenColor.bg2}
                stroke={tokenColor.border}
                strokeWidth={0.5}
                opacity={dimmed ? 0.3 : 0.92}
              />
              <text
                x={mid.x} y={mid.y}
                textAnchor="middle" dominantBaseline="central"
                fontFamily={font.mono}
                fontSize={font.size.xs}
                fontWeight={font.weight.medium}
                fill={e.color}
                opacity={dimmed ? 0.3 : 1}
                style={{ transition: "opacity 150ms" }}
              >
                {label}
              </text>
            </g>
          );
        })}

        {/* 5+6+7+8+9. Node circles, health rings, layer donut, lock, labels */}
        {layout.nodes.map((n, ni) => {
          const isHovered = hoveredNodeId === n.graphId;
          const isSelected = selectedNode === n.graphId;
          const edgeActive = layout.edges.some(
            (e) =>
              (hoveredEdge === edgeId(e) || selectedNode === e.from || selectedNode === e.to) &&
              (e.from === n.graphId || e.to === n.graphId),
          );
          const dimmed = (hoveredNodeId !== null && !isHovered) && !edgeActive && !isSelected;
          const opacity = dimmed ? 0.2 : 1;

          const breakdown = n.layerBreakdown;
          const entries = (Object.entries(breakdown) as [string, number][]).sort(([a], [b]) =>
            a < b ? -1 : a > b ? 1 : 0,
          );

          const RING_OUTER = n.radius + 10;
          const RING_INNER = n.radius + 4;
          const GAP_DEG = 4;

          const score = healthScore(n.riskScore);
          const hColor = healthColor(score);

          const shadowBlur = Math.round(4 + n.fileCount / 5);
          const shadowSpread = Math.round(2 + n.fileCount / 10);
          const nodeFilter = `drop-shadow(0 ${shadowSpread}px ${shadowBlur}px rgba(0,0,0,0.20))`;

          const labelY = n.y + n.radius + 22;

          let currentAngle = -90;

          return (
            <g
              key={`node-${n.graphId}`}
              style={{
                opacity: mounted ? opacity : 0,
                transition: `opacity 150ms ease-out`,
                animation: mounted
                  ? `stFadeUp ${ENTRY_MS}ms ${ni * NODE_STAGGER_MS}ms cubic-bezier(0.2,0,0.1,1) both`
                  : undefined,
                transformOrigin: `${n.x}px ${n.y}px`,
              }}
            >
              {/* 5a. Hover / selected glow ring */}
              {(isHovered || isSelected) && (
                <circle
                  cx={n.x} cy={n.y}
                  r={n.radius + 20}
                  fill={hexWithAlpha(n.color, 0.06)}
                  style={{ pointerEvents: "none" }}
                />
              )}

              {/* 5b. Main node circle with elevation shadow */}
              <circle
                cx={n.x} cy={n.y} r={n.radius}
                fill={hexWithAlpha(n.color, isHovered || isSelected ? 0.18 : 0.10)}
                stroke={isSelected ? n.color : isHovered ? hexWithAlpha(n.color, 0.8) : n.color}
                strokeWidth={isSelected ? 3 : isHovered ? 2.5 : 1.5}
                style={{
                  filter: nodeFilter,
                  transition: `stroke-width ${transition.fast}, stroke-opacity ${transition.fast}`,
                  cursor: "pointer",
                }}
                onMouseEnter={() => setHoveredNodeId(n.graphId)}
                onMouseLeave={() => setHoveredNodeId(null)}
                onClick={() => handleNodeClick(n)}
              />

              {/* 5c. Health score ring (arc around node, score% coverage) */}
              <HealthRing
                cx={n.x} cy={n.y} r={n.radius}
                score={score} color={hColor}
                opacity={dimmed ? 0.15 : 0.8}
              />

              {/* 6. Health pulse ring */}
              {!dimmed && (
                <HealthPulseRing
                  cx={n.x}
                  cy={n.y}
                  nodeRadius={n.radius}
                  score={score}
                />
              )}

              {/* 7. Layer donut ring segments (6px thick, with glow on hover) */}
              {entries.map(([layer, frac]) => {
                const sweep = frac * 360 - GAP_DEG;
                if (sweep < 2) { currentAngle += frac * 360; return null; }
                const layerColor = LAYER_COLORS[layer] ?? "#cdcdcd";
                const seg = (
                  <ArcSegment
                    key={`arc-${n.graphId}-${layer}`}
                    cx={n.x} cy={n.y}
                    outerR={RING_OUTER}
                    innerR={RING_INNER}
                    startAngle={currentAngle}
                    endAngle={currentAngle + sweep}
                    color={layerColor}
                    opacity={dimmed ? 0.15 : 0.78}
                    glow={isHovered || isSelected}
                  />
                );
                currentAngle += frac * 360;
                return seg;
              })}

              {/* 8. Lock icon for high-complexity nodes */}
              {n.fileCount > HIGH_COMPLEXITY_THRESHOLD && (
                <LockIcon
                  cx={n.x}
                  cy={n.y}
                  nodeRadius={n.radius}
                />
              )}

              {/* 9a. Service name inside circle */}
              <text
                x={n.x} y={n.y - 8}
                textAnchor="middle" dominantBaseline="central"
                fontFamily={font.sans}
                fontSize={Math.min(font.size.sm, n.radius * 0.32)}
                fontWeight={font.weight.semibold}
                fill={n.color}
                style={{ pointerEvents: "none", userSelect: "none" }}
                onMouseEnter={() => setHoveredNodeId(n.graphId)}
                onMouseLeave={() => setHoveredNodeId(null)}
              >
                {truncate(n.label, 14)}
              </text>

              {/* 9b. File count + LoC */}
              <text
                x={n.x} y={n.y + 8}
                textAnchor="middle" dominantBaseline="central"
                fontFamily={font.sans}
                fontSize={font.size.xs}
                fill={tokenColor.text2}
                style={{ pointerEvents: "none", userSelect: "none" }}
              >
                {n.fileCount} files · {kLoc(n.loc)} LoC
              </text>

              {/* 9c. Health score below file count */}
              <text
                x={n.x} y={n.y + 22}
                textAnchor="middle" dominantBaseline="central"
                fontFamily={font.sans}
                fontSize={font.size.xs}
                fontWeight={font.weight.medium}
                fill={hColor}
                style={{ pointerEvents: "none", userSelect: "none" }}
              >
                ↑{score}
              </text>

              {/* 9d. Layer badge below circle */}
              {(() => {
                const badgeW = 56;
                const badgeH = 14;
                return (
                  <>
                    <rect
                      x={n.x - badgeW / 2} y={labelY - 1}
                      width={badgeW} height={badgeH}
                      rx={tokenRadius.pill}
                      fill={hexWithAlpha(n.color, 0.12)}
                      style={{ pointerEvents: "none" }}
                    />
                    <text
                      x={n.x} y={labelY + 6}
                      textAnchor="middle" dominantBaseline="central"
                      fontFamily={font.sans}
                      fontSize={font.size.xxs}
                      fontWeight={font.weight.medium}
                      fill={n.color}
                      style={{ pointerEvents: "none", userSelect: "none" }}
                    >
                      {n.archLayer}
                    </text>
                  </>
                );
              })()}
            </g>
          );
        })}

        {/* 10. Header: title + subtitle + dismiss × + right chip */}
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

        {/* Right: packages · files chip */}
        <g style={{ pointerEvents: "none" }}>
          {(() => {
            const label = `${layout.nodes.length} packages · ${totalFiles} files`;
            const chipW = label.length * 5.8 + 16;
            const chipH = 18;
            const chipX = dims.w - chipW - 40;
            return (
              <>
                <rect
                  x={chipX} y={12}
                  width={chipW} height={chipH}
                  rx={tokenRadius.pill}
                  fill={tokenColor.bg3}
                  stroke={tokenColor.border}
                  strokeWidth={0.5}
                />
                <text
                  x={chipX + chipW / 2} y={12 + chipH / 2}
                  textAnchor="middle" dominantBaseline="central"
                  fontFamily={font.sans} fontSize={font.size.xs}
                  fontWeight={font.weight.medium}
                  fill={tokenColor.text1}
                >
                  {label}
                </text>
              </>
            );
          })()}
        </g>

        {/* Dismiss × */}
        {onDismiss && (
          <g
            onClick={onDismiss}
            style={{ cursor: "pointer" }}
            aria-label="Dismiss"
            role="button"
          >
            <rect
              x={dims.w - 32} y={10}
              width={22} height={22}
              rx={tokenRadius.sm}
              fill="transparent"
            />
            <text
              x={dims.w - 21} y={21}
              textAnchor="middle" dominantBaseline="central"
              fontFamily={font.sans} fontSize={font.size.md}
              fill={tokenColor.text2}
              style={{ userSelect: "none" }}
            >
              ×
            </text>
          </g>
        )}

        {/* 11. Legend panel (bottom-right) */}
        <g style={{ pointerEvents: "none" }}>
          {(() => {
            const LX = dims.w - 140;
            const LY = dims.h - 148;
            const LW = 130;
            const LH = 136;
            return (
              <>
                <rect
                  x={LX} y={LY} width={LW} height={LH}
                  rx={tokenRadius.md}
                  fill={tokenColor.bg2}
                  stroke={tokenColor.border}
                  strokeWidth={0.5}
                  opacity={0.95}
                />
                {/* Edge types */}
                <text x={LX + 10} y={LY + 12}
                  dominantBaseline="hanging"
                  fontFamily={font.sans} fontSize={font.size.xs}
                  fontWeight={font.weight.semibold}
                  fill={tokenColor.text1}>
                  Edge types
                </text>
                {(
                  [
                    ["api-call",  "#22a06b", "API call"],
                    ["rpc",       "#0d99ff", "RPC"],
                    ["queue",     "#e09321", "Queue"],
                    ["shared-db", "#7e4ed6", "Shared DB"],
                  ] as [string, string, string][]
                ).map(([, c, lbl], i) => (
                  <g key={lbl} transform={`translate(${LX + 10}, ${LY + 28 + i * 14})`}>
                    <line x1={0} y1={5} x2={14} y2={5}
                      stroke={c} strokeWidth={2}
                      strokeDasharray="4 2" strokeLinecap="round" />
                    <text x={20} y={9} dominantBaseline="hanging"
                      fontFamily={font.sans} fontSize={font.size.xs}
                      fill={tokenColor.text2}>
                      {lbl}
                    </text>
                  </g>
                ))}

                {/* Layers */}
                <text x={LX + 10} y={LY + 86}
                  dominantBaseline="hanging"
                  fontFamily={font.sans} fontSize={font.size.xs}
                  fontWeight={font.weight.semibold}
                  fill={tokenColor.text1}>
                  Layers
                </text>
                {(
                  [
                    ["domain",  "#7e4ed6", "Domain"],
                    ["adapter", "#0d99ff", "Adapter"],
                    ["infra",   "#e09321", "Infra"],
                    ["ui",      "#22a06b", "UI"],
                  ] as [string, string, string][]
                ).map(([, c, lbl], i) => (
                  <g key={lbl} transform={`translate(${LX + 10}, ${LY + 100 + i * 11})`}>
                    <circle cx={4} cy={4} r={3.5} fill={c} />
                    <text x={12} y={7} dominantBaseline="central"
                      fontFamily={font.sans} fontSize={font.size.xs}
                      fill={tokenColor.text2}>
                      {lbl}
                    </text>
                  </g>
                ))}
              </>
            );
          })()}
        </g>
      </svg>
    </div>
  );
}

export const ServiceTopoView = memo(ServiceTopoViewImpl);
