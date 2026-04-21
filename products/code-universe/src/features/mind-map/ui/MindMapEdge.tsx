// MindMapEdge — tapered bezier ribbon with gradient fill, glow, and spine highlight.
// Each edge carries its own <defs> (unique id from edge.id) so gradients track
// the correct from/to direction regardless of where the component renders in the tree.

import { memo, useEffect, useState } from "react";

import { taperedPathD, taperedSpineD } from "../lib/tapered-path";
import type { AggregatorKind, MindMapEdge as MindMapEdgeModel } from "../model/types";

export interface MindMapEdgeProps {
  edge: MindMapEdgeModel;
  from: { x: number; y: number; radius: number };
  to: { x: number; y: number; radius: number };
  hovered?: boolean;
  /** Staggered entry delay in ms — keeps trunk edges landing before spokes. */
  mountDelayMs?: number;
}

// Category accent palette — same tokens used by MindMapNode pill colors.
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
const FALLBACK_ACCENT = "#637891";

function aggAccent(edge: MindMapEdgeModel): string {
  const aggId = edge.kind === "center-to-aggregator" ? edge.toId : edge.fromId;
  if (!aggId.startsWith("agg:")) return FALLBACK_ACCENT;
  return AGG_ACCENT[aggId.slice(4) as AggregatorKind] ?? FALLBACK_ACCENT;
}

// Derive a CSS-safe id fragment from an arbitrary string.
function cssId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9]/g, "_");
}

function MindMapEdgeImpl({
  edge,
  from,
  to,
  hovered = false,
  mountDelayMs = 0,
}: MindMapEdgeProps) {
  // Entry fade-in — same two-rAF pattern as MindMapNode so the CSS
  // transition always has a distinct "from" frame to interpolate.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    let r1 = 0, r2 = 0, t = 0;
    r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => {
        t = window.setTimeout(() => setMounted(true), mountDelayMs);
      });
    });
    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
      window.clearTimeout(t);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.5) return null;

  const ux = dx / dist;
  const uy = dy / dist;
  const insetFrom = from.radius + 1;
  const insetTo   = to.radius   + 1;
  if (insetFrom + insetTo >= dist) return null;

  const x0 = from.x + ux * insetFrom;
  const y0 = from.y + uy * insetFrom;
  const x1 = to.x   - ux * insetTo;
  const y1 = to.y   - uy * insetTo;

  const isTrunk   = edge.kind === "center-to-aggregator";
  const widthMult = hovered ? 1.4 : 1.0;
  const w0 = (edge.widthStart / 2) * widthMult;
  const w1 = (edge.widthEnd   / 2) * widthMult;
  const curvature = dist < 80 ? 0.12 : 0.22;

  const d      = taperedPathD({ x0, y0, x1, y1, w0, w1, curvature, steps: 40 });
  const spineD = taperedSpineD({ x0, y0, x1, y1, curvature });
  if (!d) return null;

  const accent = aggAccent(edge);
  const gid    = cssId(edge.id);
  const gradId = `mmg_${gid}`;
  const glowId = `mmglow_${gid}`;

  // Gradient stop opacities — trunk is bolder than spokes. Leaf-side
  // stops used to fade to 14% which collapsed the aggregator's accent
  // colour into the dark background; bumped so each AggregatorKind
  // (siblings/callers/callees/...) stays legible at both ends.
  const stopFrom = isTrunk ? 0.90 : 0.80;
  const stopTo   = isTrunk ? 0.55 : 0.45;

  const groupStyle: React.CSSProperties = {
    opacity:    mounted ? 1 : 0,
    transition: "opacity 220ms ease-out",
    pointerEvents: "none",
  };

  return (
    <g style={groupStyle} data-edge-kind={edge.kind} data-edge-id={edge.id}>
      <defs>
        {/* Direction-aware gradient along the edge axis */}
        <linearGradient
          id={gradId}
          gradientUnits="userSpaceOnUse"
          x1={x0} y1={y0}
          x2={x1} y2={y1}
        >
          <stop offset="0%"   stopColor={accent} stopOpacity={stopFrom} />
          <stop offset="100%" stopColor={accent} stopOpacity={stopTo}   />
        </linearGradient>

        {/* Soft glow filter — trunk edges only */}
        {isTrunk && (
          <filter id={glowId} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur in="SourceGraphic" stdDeviation={hovered ? 4 : 2.5} result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        )}
      </defs>

      {/* ── Glow halo (trunk only) ──────────────────────────────── */}
      {isTrunk && (
        <path
          d={d}
          fill={accent}
          fillOpacity={hovered ? 0.22 : 0.10}
          stroke="none"
          filter={`url(#${glowId})`}
          style={{ transition: "fill-opacity 180ms ease-out" }}
        />
      )}

      {/* ── Main ribbon ─────────────────────────────────────────── */}
      <path
        d={d}
        fill={`url(#${gradId})`}
        stroke="none"
        style={{ transition: "d 300ms ease-out" }}
      />

      {/* ── Spine highlight ─────────────────────────────────────── */}
      {/* Thin centerline that gives the ribbon a physical depth. Tinted
       *  with the aggregator accent (not pure white) on spokes so the
       *  per-type colour reads from end to end — white spine used to
       *  flatten every spoke into the same "bright thread" silhouette. */}
      <path
        d={spineD}
        fill="none"
        stroke={isTrunk ? "white" : accent}
        strokeWidth={isTrunk ? 0.9 : 0.6}
        strokeOpacity={isTrunk ? (hovered ? 0.38 : 0.20) : (hovered ? 0.95 : 0.75)}
        strokeLinecap="round"
        style={{ transition: "stroke-opacity 180ms ease-out" }}
      />
    </g>
  );
}

export const MindMapEdge = memo(MindMapEdgeImpl);
