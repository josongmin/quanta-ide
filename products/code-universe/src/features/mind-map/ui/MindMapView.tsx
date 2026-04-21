// MindMapView — SVG renderer for the egocentric mind-map.
// Interaction: wheel to zoom (toward cursor), drag to pan, dbl-click to reset.
// Renders in z-order: dot-grid → backdrop → edges → nodes.
// CSS keyframes for micro-animations are injected via a <style> block.

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { AggregatorKind, MindMapGraph, MindMapNode as MindMapNodeModel } from "../model/types";
import { MindMapEdge } from "./MindMapEdge";
import { MindMapNode } from "./MindMapNode";

// ── Category palette (mirrors MindMapNode / MindMapEdge) ──────────────
const AGG_ACCENT: Readonly<Record<AggregatorKind, string>> = {
  callers:          "#0d99ff",
  callees:          "#e09321",
  siblings:         "#9e77ff",
  children:         "#22a06b",
  "parent-dir":     "#8c9bab",
  "external-deps":  "#e5484d",
  inheritance:      "#f76b15",
  "data-relations": "#30a46c",
};
const AGG_LABEL: Readonly<Record<AggregatorKind, string>> = {
  "parent-dir":     "PARENTS",
  children:         "CHILDREN",
  siblings:         "SIBLINGS",
  callers:          "CALLERS",
  callees:          "CALLEES",
  "external-deps":  "EXTERNAL",
  inheritance:      "INHERITS",
  "data-relations": "DATA",
};

// ── Sector geometry ──────────────────────────────────────────────────
interface Sector {
  id: string;
  kind: AggregatorKind;
  aggAngle: number;
  startAngle: number;
  endAngle: number;
  accent: string;
  label: string;
}

// CSS-safe id suffix for per-sector <defs>
function cssId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9]/g, "_");
}

/** Compute angular span per aggregator from the graph's leaf angles. */
function buildSectors(graph: MindMapGraph): Sector[] {
  const nodeById = new Map<string, MindMapNodeModel>();
  for (const n of graph.nodes) nodeById.set(n.id, n);

  const leavesByAgg = new Map<string, MindMapNodeModel[]>();
  for (const e of graph.edges) {
    if (e.kind !== "aggregator-to-entity") continue;
    const leaf = nodeById.get(e.toId);
    if (!leaf) continue;
    const bucket = leavesByAgg.get(e.fromId) ?? [];
    bucket.push(leaf);
    leavesByAgg.set(e.fromId, bucket);
  }

  const sectors: Sector[] = [];
  for (const agg of graph.nodes) {
    if (agg.kind !== "aggregator" || !agg.aggregatorKind) continue;
    const leaves = leavesByAgg.get(agg.id) ?? [];
    if (leaves.length === 0) continue;

    // Normalise leaf angles to (-π, π] relative to aggregator — avoids
    // the 0 / 2π wrap-around discontinuity when the sector straddles east.
    const rels = leaves.map(l => {
      let d = l.angle - agg.angle;
      while (d >  Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      return d;
    });
    const minRel = Math.min(...rels, 0);
    const maxRel = Math.max(...rels, 0);
    // Pad the arc 5° minimum so the wedge breathes past extreme leaves.
    const pad    = Math.max(Math.PI / 36, (maxRel - minRel) * 0.12);

    sectors.push({
      id:         agg.id,
      kind:       agg.aggregatorKind,
      aggAngle:   agg.angle,
      startAngle: agg.angle + minRel - pad,
      endAngle:   agg.angle + maxRel + pad,
      accent:     AGG_ACCENT[agg.aggregatorKind] ?? "#8c9bab",
      label:      AGG_LABEL[agg.aggregatorKind] ?? agg.label,
    });
  }
  return sectors;
}

/** Pie-slice wedge: apex at origin, arc at outer radius. */
function wedgeD(s: Sector, rOuter: number): string {
  const x0 = rOuter * Math.cos(s.startAngle);
  const y0 = rOuter * Math.sin(s.startAngle);
  const x1 = rOuter * Math.cos(s.endAngle);
  const y1 = rOuter * Math.sin(s.endAngle);
  const largeArc = (s.endAngle - s.startAngle) > Math.PI ? 1 : 0;
  return `M0,0 L${x0.toFixed(2)},${y0.toFixed(2)} A${rOuter},${rOuter} 0 ${largeArc} 1 ${x1.toFixed(2)},${y1.toFixed(2)} Z`;
}

/** Arc path (no stroke fill — used as a curved textPath target). */
function arcD(rArc: number, startAngle: number, endAngle: number): string {
  const x0 = rArc * Math.cos(startAngle);
  const y0 = rArc * Math.sin(startAngle);
  const x1 = rArc * Math.cos(endAngle);
  const y1 = rArc * Math.sin(endAngle);
  const largeArc = (endAngle - startAngle) > Math.PI ? 1 : 0;
  return `M${x0.toFixed(2)},${y0.toFixed(2)} A${rArc},${rArc} 0 ${largeArc} 1 ${x1.toFixed(2)},${y1.toFixed(2)}`;
}

export interface MindMapViewProps {
  graph: MindMapGraph | null;
  width: number;
  height: number;
  onFocusEntity?: (entityId: string) => void;
  onDismiss?: () => void;
}

// ── Stagger schedule (ms) ────────────────────────────────────────────
// Slightly stretched so the outer group rotation and per-node scale-in
// read as a coordinated "unfolding" rather than two animations
// overlapping. Entity base/step bumped because the per-node scale now
// plays on TOP of a group-level rotate-in — want them to crystallise
// after the rotation settles, not during it.
const DELAY_CENTER     = 40;
const DELAY_AGG        = 140;
const DELAY_TRUNK_EDGE = 110;
const DELAY_SPOKE_BASE = 260;
const DELAY_SPOKE_STEP = 18;
const DELAY_ENTITY_BASE = 220;
const DELAY_ENTITY_STEP = 22;

// ── CSS keyframes ────────────────────────────────────────────────────
const KEYFRAMES = `
@keyframes mm-breathe {
  0%, 100% { opacity: 0.38; transform: scale(1);    }
  50%       { opacity: 0.14; transform: scale(1.35); }
}
@keyframes mm-hover-ring {
  0%   { r: 0;  opacity: 0.6; }
  80%  { r: 18; opacity: 0;   }
  100% { r: 18; opacity: 0;   }
}
@keyframes mm-edge-drift {
  0%, 100% { stroke-opacity: 0.55; }
  50%       { stroke-opacity: 0.78; }
}
/* Entrance — re-plays on every re-center via key={centerId} on the
 * wrapper. A fast "쉬리릭" swing: the graph spins in ~135° CCW from
 * a small, dim scale, then uses the last third of the timeline to
 * glide smoothly into place. The two-step easing (aggressive first
 * half via the 40% → 70% keyframes, cubic-out on the rest) gives the
 * whoosh feel without overshooting the rest position. */
@keyframes mm-enter {
  0%   { opacity: 0; transform: rotate(-135deg) scale(0.60); }
  25%  { opacity: 0.55;                                      }
  55%  { opacity: 1;  transform: rotate(-18deg) scale(0.96); }
  78%  { transform: rotate(6deg)   scale(1.02);              }
  100% { opacity: 1;  transform: rotate(0deg)   scale(1);    }
}
`;

// ── Zoom / pan helpers ───────────────────────────────────────────────
interface ZP { scale: number; tx: number; ty: number }
const ZP_INIT: ZP = { scale: 1, tx: 0, ty: 0 };
function clampScale(s: number) { return Math.max(0.18, Math.min(6, s)); }

function MindMapViewImpl({
  graph,
  width,
  height,
  onFocusEntity,
  onDismiss,
}: MindMapViewProps) {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const handleHoverChange = useCallback((id: string | null) => setHoveredNodeId(id), []);

  // ── Per-node offsets — manually dragged positions layered on top of
  // the algorithmic polar layout. Reset when the center changes so a
  // new graph starts clean. ─────────────────────────────────────────
  const [offsets, setOffsets] = useState<Record<string, { dx: number; dy: number }>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);

  useEffect(() => {
    setOffsets({});
    setDraggingId(null);
  }, [graph?.centerId]);

  const handleNodeOffsetChange = useCallback((id: string, dx: number, dy: number) => {
    setOffsets(prev => ({ ...prev, [id]: { dx, dy } }));
  }, []);
  const handleNodeDragStart = useCallback((id: string) => setDraggingId(id), []);
  const handleNodeDragEnd   = useCallback(() => setDraggingId(null), []);

  // ── Zoom / pan state ─────────────────────────────────────────────
  const [zp, setZp] = useState<ZP>(ZP_INIT);
  const [isDragging, setIsDragging] = useState(false);
  const svgRef  = useRef<SVGSVGElement>(null);
  // drag state tracked in ref to avoid stale closures during mousemove
  const drag = useRef({ active: false, moved: false, x0: 0, y0: 0, tx0: 0, ty0: 0 });

  // Wheel: zoom toward cursor. Must be non-passive to call preventDefault.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      // Gentle zoom — scaled by wheel delta magnitude so trackpad pinch
      // (small deltas) ≈ 3% per event, mouse-wheel (large deltas)
      // caps at ~6%. Previous 14%-per-notch was aggressive on trackpads.
      const mag   = Math.min(Math.abs(e.deltaY), 50) / 50; // 0..1
      const step  = 0.03 + mag * 0.03;                      // 3%..6%
      const factor = e.deltaY < 0 ? 1 + step : 1 / (1 + step);
      const r = el.getBoundingClientRect();
      const cx = e.clientX - r.left;
      const cy = e.clientY - r.top;
      setZp(prev => {
        const ns = clampScale(prev.scale * factor);
        const f  = ns / prev.scale;
        return {
          scale: ns,
          // Keep the graph point under the cursor fixed:
          // origin_svg = (width/2 + tx, height/2 + ty), zoom around (cx,cy)
          tx: cx - width  / 2 - (cx - width  / 2 - prev.tx) * f,
          ty: cy - height / 2 - (cy - height / 2 - prev.ty) * f,
        };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [width, height]);

  const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    drag.current = { active: true, moved: false, x0: e.clientX, y0: e.clientY, tx0: zp.tx, ty0: zp.ty };
    setIsDragging(true);
  }, [zp.tx, zp.ty]);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d.active) return;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    if (!d.moved && Math.hypot(dx, dy) > 4) d.moved = true;
    if (d.moved) setZp(prev => ({ ...prev, tx: d.tx0 + dx, ty: d.ty0 + dy }));
  }, []);

  const handleMouseUp = useCallback(() => {
    drag.current.active = false;
    setIsDragging(false);
  }, []);

  const handleDblClick = useCallback(() => setZp(ZP_INIT), []);

  const handleBackdropClick = useCallback(() => {
    if (drag.current.moved) return;
    onDismiss?.();
  }, [onDismiss]);

  // ── Graph helpers ────────────────────────────────────────────────
  // Node positions combine the algorithmic layout (n.x / n.y) with any
  // per-node drag offset the user applied. Edges re-compute from this
  // index so they track a dragged node in real time.
  const nodeIndex = useMemo(() => {
    const map = new Map<string, { x: number; y: number; radius: number }>();
    if (graph) for (const n of graph.nodes) {
      const off = offsets[n.id];
      map.set(n.id, {
        x: n.x + (off?.dx ?? 0),
        y: n.y + (off?.dy ?? 0),
        radius: n.radius,
      });
    }
    return map;
  }, [graph, offsets]);

  const edgesByNode = useMemo(() => {
    const map = new Map<string, Set<string>>();
    if (graph) {
      for (const e of graph.edges) {
        if (!map.has(e.fromId)) map.set(e.fromId, new Set());
        if (!map.has(e.toId))   map.set(e.toId,   new Set());
        map.get(e.fromId)!.add(e.id);
        map.get(e.toId)!.add(e.id);
      }
    }
    return map;
  }, [graph]);

  if (!graph) return null;

  const sortedEdges   = [...graph.edges].sort((a, b) => a.weight - b.weight);
  const hoveredEdges  = hoveredNodeId ? edgesByNode.get(hoveredNodeId) : undefined;
  const aggSpokeIndex = new Map<string, number>();

  // Derive ring radii from node distances (layout is polar — aggregators
  // all share one distance, entities cluster near another).
  const aggDistances = graph.nodes.filter(n => n.kind === "aggregator").map(n => n.distance);
  const entDistances = graph.nodes.filter(n => n.kind === "entity").map(n => n.distance);
  const R1 = aggDistances.length ? aggDistances.reduce((a, b) => a + b, 0) / aggDistances.length : 0;
  const R2 = entDistances.length ? Math.max(...entDistances) : 0;
  // Wedges extend just past the entity ring; labels curve a touch beyond.
  const R_WEDGE = R2 + 34;
  const R_LABEL = R2 + 22;
  const sectors = buildSectors(graph);
  // Fade entire atmosphere layer down when hovering a node — keeps
  // focus on the active relationship, not the decorative scaffolding.
  const atmosphereDim = hoveredNodeId ? 0.35 : 1;

  // Root group transform: origin → (width/2 + tx, height/2 + ty), scale around origin.
  const rootTransform = `translate(${width / 2 + zp.tx}px, ${height / 2 + zp.ty}px) scale(${zp.scale})`;

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{
        display: "block",
        userSelect: "none",
        background: "transparent",
        cursor: isDragging || draggingId ? "grabbing" : "grab",
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={handleDblClick}
      role="img"
      aria-label="Entity relationship mind-map"
    >
      <style>{KEYFRAMES}</style>

      <defs>
        <pattern id="mm-dotgrid" x={0} y={0} width={24} height={24} patternUnits="userSpaceOnUse">
          <circle cx={12} cy={12} r={0.9} fill="currentColor" opacity={0.12} />
        </pattern>
        <filter id="mm-center-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="10" result="blur" />
          <feColorMatrix in="blur" type="matrix"
            values="0 0 0 0 0.05  0 0 0 0 0.60  0 0 0 0 1  0 0 0 0.40 0"
            result="tinted" />
          <feMerge>
            <feMergeNode in="tinted" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* Soft drop-shadow for entity + aggregator nodes — gives
         *  depth so the floating motion feels real, not just layered. */}
        <filter id="mm-soft-shadow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur" />
          <feOffset in="blur" dx="0" dy="3" result="offset" />
          <feColorMatrix in="offset" type="matrix"
            values="0 0 0 0 0.05  0 0 0 0 0.10  0 0 0 0 0.18  0 0 0 0.16 0"
            result="shadow" />
          <feMerge>
            <feMergeNode in="shadow" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* Radial vignette — subtle darkening at edges gives the
         *  floating nodes a "space" backdrop to breathe in. */}
        <radialGradient id="mm-vignette" cx="50%" cy="50%" r="75%">
          <stop offset="0%"  stopColor="rgba(13,153,255,0)" />
          <stop offset="65%" stopColor="rgba(13,153,255,0)" />
          <stop offset="100%" stopColor="rgba(13,153,255,0.04)" />
        </radialGradient>
        {/* Per-sector wedge gradient — alpha ramps from 0 at the apex
         *  (where it would drown the center) to a faint tint at the rim. */}
        {sectors.map(s => (
          <radialGradient
            key={s.id}
            id={`mm-sector-${cssId(s.id)}`}
            cx="0" cy="0" r={R_WEDGE}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%"   stopColor={s.accent} stopOpacity={0.00} />
            <stop offset="42%"  stopColor={s.accent} stopOpacity={0.04} />
            <stop offset="82%"  stopColor={s.accent} stopOpacity={0.08} />
            <stop offset="100%" stopColor={s.accent} stopOpacity={0.00} />
          </radialGradient>
        ))}
      </defs>

      {/* Dot-grid */}
      <rect x={0} y={0} width={width} height={height}
        fill="url(#mm-dotgrid)"
        style={{ pointerEvents: "none", color: "var(--color-text2, #8c9bab)" }}
      />

      {/* Vignette — subtle radial tint so floating nodes have "space" depth */}
      <rect x={0} y={0} width={width} height={height}
        fill="url(#mm-vignette)"
        style={{ pointerEvents: "none" }}
      />

      {/* Backdrop: click-outside dismiss, dbl-click zoom-reset */}
      <rect x={0} y={0} width={width} height={height}
        fill="transparent"
        onClick={handleBackdropClick}
      />

      {/* Zoom level hint (bottom-right, only when zoomed) */}
      {Math.abs(zp.scale - 1) > 0.05 && (
        <text
          x={width - 10} y={height - 10}
          textAnchor="end"
          fontFamily="'Inter Tight', sans-serif"
          fontSize={10}
          fill="rgba(0,0,0,0.28)"
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          {Math.round(zp.scale * 100)}%
        </text>
      )}

      <g
        className="mindmap-root"
        style={{ transform: rootTransform, transformOrigin: "0px 0px" }}
      >
        {/* Centered-content wrapper — keyed by centerId so React remounts
         *  it on every re-center, which re-plays the `mm-enter` keyframe
         *  (fade + ~30° unrotation + scale). Rotation origin is (0,0)
         *  within this group, which maps to the centre node's position,
         *  so the graph swings into place around its new focus instead
         *  of around the viewport corner. Node-level stagger (mountDelayMs)
         *  layers on top — center first, aggregators, then entities. */}
        <g
          key={graph.centerId}
          style={{
            animation: "mm-enter 900ms cubic-bezier(0.22, 1, 0.28, 1) both",
            transformOrigin: "0px 0px",
            transformBox: "fill-box",
          }}
        >
        {/* ── Atmosphere layer ──────────────────────────────────────────
         *  Sits beneath the edges/nodes. Provides:
         *    (a) pie-slice wedges that visually bind each aggregator's
         *        leaves to its category accent without adding noise to
         *        the individual nodes,
         *    (b) two thin dashed guide rings at the aggregator and
         *        entity distances — gives the composition a planetary
         *        "orbit" grammar,
         *    (c) curved textPath labels (PARENTS / CALLERS / …) along
         *        the outer arc, set wide with letter-spacing so the
         *        typography itself becomes a decorative element. */}
        {sectors.length > 0 && (
          <g
            aria-hidden="true"
            style={{
              opacity: atmosphereDim,
              transition: "opacity 220ms ease-out",
              pointerEvents: "none",
            }}
          >
            {/* Wedges — tinted pie slices per category */}
            {sectors.map(s => (
              <path
                key={`w-${s.id}`}
                d={wedgeD(s, R_WEDGE)}
                fill={`url(#mm-sector-${cssId(s.id)})`}
                stroke="none"
              />
            ))}
            {/* Outer sector rim — thin accent arc along R_WEDGE */}
            {sectors.map(s => (
              <path
                key={`r-${s.id}`}
                d={arcD(R_WEDGE, s.startAngle, s.endAngle)}
                fill="none"
                stroke={s.accent}
                strokeWidth={0.9}
                strokeOpacity={0.35}
                strokeLinecap="round"
              />
            ))}
            {/* Guide rings — orbital scaffolding */}
            {R1 > 0 && (
              <circle
                cx={0} cy={0} r={R1}
                fill="none"
                stroke="rgba(13,153,255,0.18)"
                strokeWidth={0.6}
                strokeDasharray="1.5 5"
              />
            )}
            {R2 > 0 && (
              <circle
                cx={0} cy={0} r={R2}
                fill="none"
                stroke="rgba(13,153,255,0.14)"
                strokeWidth={0.6}
                strokeDasharray="1.5 5"
              />
            )}
            {/* Curved category labels along the outer arc */}
            <defs>
              {sectors.map(s => (
                <path
                  key={`p-${s.id}`}
                  id={`mm-label-${cssId(s.id)}`}
                  d={arcD(R_LABEL, s.startAngle, s.endAngle)}
                  fill="none"
                />
              ))}
            </defs>
            {sectors.map(s => {
              // Only show the label if the arc is wide enough to hold
              // the text comfortably — otherwise the letters cramp and
              // the decoration becomes noise.
              const arcLenPx = (s.endAngle - s.startAngle) * R_LABEL;
              const fits     = arcLenPx > s.label.length * 9;
              if (!fits) return null;
              return (
                <text
                  key={`t-${s.id}`}
                  fontFamily="'Inter Tight', sans-serif"
                  fontSize={10}
                  fontWeight={600}
                  fill={s.accent}
                  fillOpacity={0.58}
                  letterSpacing="0.22em"
                >
                  <textPath
                    href={`#mm-label-${cssId(s.id)}`}
                    startOffset="50%"
                    textAnchor="middle"
                  >
                    {s.label}
                  </textPath>
                </text>
              );
            })}
          </g>
        )}

        {/* Edges */}
        {sortedEdges.map((edge) => {
          const from = nodeIndex.get(edge.fromId);
          const to   = nodeIndex.get(edge.toId);
          if (!from || !to) return null;

          const hovered = hoveredEdges?.has(edge.id) ?? false;
          let mountDelayMs: number;
          if (edge.kind === "center-to-aggregator") {
            mountDelayMs = DELAY_TRUNK_EDGE;
          } else {
            const idx = aggSpokeIndex.get(edge.fromId) ?? 0;
            aggSpokeIndex.set(edge.fromId, idx + 1);
            mountDelayMs = DELAY_SPOKE_BASE + idx * DELAY_SPOKE_STEP;
          }
          return (
            <MindMapEdge key={edge.id} edge={edge} from={from} to={to}
              hovered={hovered} mountDelayMs={mountDelayMs} />
          );
        })}

        {/* Nodes */}
        {graph.nodes.map((node) => {
          let mountDelay: number;
          if (node.kind === "center") {
            mountDelay = DELAY_CENTER;
          } else if (node.kind === "aggregator") {
            mountDelay = DELAY_AGG;
          } else {
            const twoPi  = Math.PI * 2;
            const norm   = ((node.angle % twoPi) + twoPi) % twoPi;
            const bucket = Math.floor((norm / twoPi) * 12);
            mountDelay   = DELAY_ENTITY_BASE + bucket * DELAY_ENTITY_STEP;
          }
          const off = offsets[node.id];
          return (
            <MindMapNode
              key={node.id}
              node={node}
              mountDelayMs={mountDelay}
              positionTransitionMs={0}
              onFocusEntity={onFocusEntity}
              onHoverChange={handleHoverChange}
              offsetX={off?.dx ?? 0}
              offsetY={off?.dy ?? 0}
              viewScale={zp.scale}
              onOffsetChange={handleNodeOffsetChange}
              onDragStart={handleNodeDragStart}
              onDragEnd={handleNodeDragEnd}
              anyDragging={draggingId !== null}
              isThisDragging={draggingId === node.id}
            />
          );
        })}
        </g>
      </g>
    </svg>
  );
}

export const MindMapView = memo(MindMapViewImpl);
