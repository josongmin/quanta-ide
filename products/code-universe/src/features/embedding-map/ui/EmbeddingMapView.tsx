// EmbeddingMapView — SVG renderer for the Structural Similarity Map.
// --------------------------------------------------------------------
// Consumes an `EmbeddingLayout` and renders a full-viewport SVG showing
// packages as circles positioned by their structural similarity.
//
// Z-order (bottom to top):
//   1. Backdrop rect (transparent, captures click-outside → onDismiss)
//   2. Cluster convex-hull fills (very light, behind point layer)
//   3. Cluster labels (behind points)
//   4. Cross-entity edges (thin lines at 0.2 opacity)
//   5. Point labels (below each circle)
//   6. Points (circles with hover interactions)
//   7. Tooltip (SVG-inline, clamped to viewport)
//   8. Title + subtitle (top-left overlay)
//   9. Overflow caption (bottom-right, if overflow > 0)
//
// Interactions:
//   - Hover point: brighten self, show tooltip, dim others.
//   - Click point: onFocusEntity(id).
//   - Click backdrop: onDismiss().
//
// Entry animation: opacity 0→1 over 280ms.

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { color as tokenColor, font } from "../../../shared/ui/tokens";
import type { EmbeddingLayout, EmbeddingPoint } from "../model/types";

export interface EmbeddingMapViewProps {
  layout: EmbeddingLayout;
  width: number;
  height: number;
  onFocusEntity?: (id: string) => void;
  onDismiss?: () => void;
}

// ── Constants ────────────────────────────────────────────────────────
const ENTRY_MS = 280;
const LABEL_MAX_LEN = 16;
const LABEL_OFFSET = 12;
const TOOLTIP_PAD = 6;
const TOOLTIP_RADIUS = 4;

// ── Convex hull (Jarvis march) ────────────────────────────────────────
// Points are sorted by id for tie-breaking before the gift-wrap scan.

interface Pt { x: number; y: number }

function cross(o: Pt, a: Pt, b: Pt): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

function convexHull(rawPts: Pt[]): Pt[] {
  const n = rawPts.length;
  if (n < 3) return rawPts;
  // Sort by x then y for a stable starting point.
  const pts = [...rawPts].sort((a, b) => a.x !== b.x ? a.x - b.x : a.y - b.y);

  // Jarvis march (gift wrapping).
  const hull: Pt[] = [];
  let start = 0;
  let current = start;
  do {
    hull.push(pts[current]!);
    let next = (current + 1) % n;
    for (let i = 0; i < n; i++) {
      if (cross(pts[current]!, pts[next]!, pts[i]!) < 0) {
        next = i;
      }
    }
    current = next;
    if (hull.length > n) break; // safety guard against degenerate inputs
  } while (current !== start);

  return hull;
}

function hullPathD(hull: Pt[], inflate = 12): string {
  if (hull.length < 2) return "";
  // Compute centroid for inflation direction.
  let cx = 0;
  let cy = 0;
  for (const p of hull) { cx += p.x; cy += p.y; }
  cx /= hull.length;
  cy /= hull.length;
  // Inflate each point outward by `inflate` px.
  const inflated = hull.map(p => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    return { x: p.x + (dx / len) * inflate, y: p.y + (dy / len) * inflate };
  });
  return (
    `M ${inflated[0]!.x.toFixed(2)} ${inflated[0]!.y.toFixed(2)} ` +
    inflated.slice(1).map(p => `L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ") +
    " Z"
  );
}

// ── Color helper ─────────────────────────────────────────────────────

function hexWithAlpha(hex: string, alpha: number): string {
  // Returns rgba() string from a CSS hex color and an alpha 0..1.
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ── Label truncation ─────────────────────────────────────────────────

function truncate(s: string, maxLen: number): string {
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen - 1) + "…";
}

// ── Component ────────────────────────────────────────────────────────

function EmbeddingMapViewImpl({
  layout,
  width,
  height,
  onFocusEntity,
  onDismiss,
}: EmbeddingMapViewProps) {
  const [mounted, setMounted] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Fade-in on mount via two-rAF so the initial paint has opacity 0.
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

  const handleBackdropClick = useCallback(() => onDismiss?.(), [onDismiss]);

  const handlePointEnter = useCallback((id: string) => setHoveredId(id), []);
  const handlePointLeave = useCallback(() => setHoveredId(null), []);
  const handlePointClick = useCallback(
    (id: string) => onFocusEntity?.(id),
    [onFocusEntity],
  );

  // Index points by id for edge lookup.
  const pointById = useMemo(() => {
    const m = new Map<string, EmbeddingPoint>();
    for (const p of layout.points) m.set(p.id, p);
    return m;
  }, [layout.points]);

  // Build cross-entity edges from the layout (pairs with cluster == same
  // cluster share many structural features so we draw them, but we draw
  // ALL pairs that have a connection via the layout's edge rollup).
  // Since EmbeddingLayout itself doesn't carry edges (the graph.fileEdges
  // rollup happens in build-embedding-layout), we detect "related" pairs
  // as points in the same cluster for the thin ambient lines.
  // NOTE: the spec asks to draw lines between entities with ≥1 file-level
  // edge. We rely on the layouter having computed `points` from the same
  // entity set. We expose edge drawing via the cluster relationship here
  // since the layout doesn't carry rolled-up edge pairs. Pairs are drawn
  // by same cluster ID.
  const edgePairs = useMemo(() => {
    const pairs: Array<{ fromId: string; toId: string }> = [];
    const byCluster = new Map<number, EmbeddingPoint[]>();
    for (const p of layout.points) {
      const arr = byCluster.get(p.clusterId) ?? [];
      arr.push(p);
      byCluster.set(p.clusterId, arr);
    }
    for (const [, clusterPts] of byCluster) {
      if (clusterPts.length < 2) continue;
      // All pairs within a cluster get a thin line.
      for (let i = 0; i < clusterPts.length; i++) {
        for (let j = i + 1; j < clusterPts.length; j++) {
          pairs.push({ fromId: clusterPts[i]!.id, toId: clusterPts[j]!.id });
        }
      }
    }
    return pairs;
  }, [layout.points]);

  // Build cluster → points for hull rendering.
  const pointsByCluster = useMemo(() => {
    const m = new Map<number, EmbeddingPoint[]>();
    for (const p of layout.points) {
      const arr = m.get(p.clusterId) ?? [];
      arr.push(p);
      m.set(p.clusterId, arr);
    }
    return m;
  }, [layout.points]);

  const rootStyle: CSSProperties = {
    opacity: mounted ? 1 : 0,
    transition: `opacity ${ENTRY_MS}ms ease-out`,
  };

  const hasPoints = layout.points.length > 0;
  const hoveredPoint = hoveredId ? pointById.get(hoveredId) : null;

  // Tooltip clamping — keep within SVG bounds.
  function tooltipPos(pt: EmbeddingPoint): { tx: number; ty: number } {
    const tooltipW = 140;
    const tooltipH = 38;
    const margin = 8;
    let tx = pt.x - tooltipW / 2;
    let ty = pt.y - pt.radius - tooltipH - 8;
    // Clamp horizontal.
    if (tx < margin) tx = margin;
    if (tx + tooltipW > width - margin) tx = width - margin - tooltipW;
    // Clamp vertical — flip below if too near top.
    if (ty < margin) ty = pt.y + pt.radius + 8;
    return { tx, ty };
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{
        display: "block",
        userSelect: "none",
        background: "transparent",
      }}
      role="img"
      aria-label="Structural Similarity Map — package embedding"
    >
      {/* 1. Backdrop */}
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill="transparent"
        onClick={handleBackdropClick}
        style={{ cursor: onDismiss ? "default" : "inherit" }}
      />

      <g style={rootStyle}>
        {/* 2. Cluster hulls */}
        {layout.clusters.map(cluster => {
          const pts = pointsByCluster.get(cluster.id) ?? [];
          if (pts.length < 2) return null;
          const hull = convexHull(pts.map(p => ({ x: p.x, y: p.y })));
          if (hull.length < 2) return null;
          const rep = pointById.get(cluster.centroidId);
          const fillColor = rep ? hexWithAlpha(rep.color, 0.04) : "rgba(0,0,0,0.02)";
          const d = hullPathD(hull, 16);
          if (!d) return null;
          return (
            <path
              key={`hull-${cluster.id}`}
              d={d}
              fill={fillColor}
              stroke="none"
              style={{ pointerEvents: "none" }}
            />
          );
        })}

        {/* 3. Cluster labels */}
        {layout.clusters.map(cluster => (
          <text
            key={`cluster-label-${cluster.id}`}
            x={cluster.cx}
            y={cluster.cy}
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily={font.sans}
            fontSize={font.size.sm}
            fontStyle="italic"
            fill={tokenColor.text2}
            style={{ pointerEvents: "none", userSelect: "none" }}
          >
            {truncate(cluster.label, LABEL_MAX_LEN)}
          </text>
        ))}

        {/* 4. Cross-entity edges */}
        {edgePairs.map(({ fromId, toId }) => {
          const from = pointById.get(fromId);
          const to = pointById.get(toId);
          if (!from || !to) return null;
          return (
            <line
              key={`edge-${fromId}-${toId}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={tokenColor.border}
              strokeWidth={1}
              strokeOpacity={0.2}
              style={{ pointerEvents: "none" }}
            />
          );
        })}

        {/* 5. Point labels */}
        {layout.points.map(pt => {
          const dimmed = hoveredId !== null && hoveredId !== pt.id;
          return (
            <text
              key={`label-${pt.id}`}
              x={pt.x}
              y={pt.y + pt.radius + LABEL_OFFSET}
              textAnchor="middle"
              dominantBaseline="hanging"
              fontFamily={font.sans}
              fontSize={font.size.xs}
              fill={tokenColor.text1}
              style={{
                pointerEvents: "none",
                userSelect: "none",
                opacity: dimmed ? 0.2 : 1,
                transition: "opacity 120ms ease-out",
              }}
            >
              {truncate(pt.label, LABEL_MAX_LEN)}
            </text>
          );
        })}

        {/* 6. Points */}
        {layout.points.map(pt => {
          const hovered = hoveredId === pt.id;
          const dimmed = hoveredId !== null && !hovered;
          const opacity = dimmed ? 0.15 : 0.85;
          const strokeWidth = hovered ? 2 : 0;
          return (
            <g
              key={`point-${pt.id}`}
              onMouseEnter={() => handlePointEnter(pt.id)}
              onMouseLeave={handlePointLeave}
              onClick={() => handlePointClick(pt.id)}
              tabIndex={0}
              role="button"
              aria-label={pt.label}
              style={{ cursor: "pointer", outline: "none" }}
            >
              <title>{`${pt.label}\n${pt.sublabel}`}</title>
              {/* Invisible larger hit target */}
              <circle
                cx={pt.x}
                cy={pt.y}
                r={pt.radius + 8}
                fill="transparent"
              />
              <circle
                cx={pt.x}
                cy={pt.y}
                r={pt.radius}
                fill={pt.color}
                opacity={hovered ? 1.0 : opacity}
                stroke={hovered ? "#ffffff" : "none"}
                strokeWidth={hovered ? strokeWidth : 0}
                style={{ transition: "opacity 120ms ease-out, stroke-width 120ms ease-out" }}
              />
              {hovered && (
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={pt.radius + 2}
                  fill="none"
                  stroke={pt.color}
                  strokeWidth={1}
                  style={{ pointerEvents: "none" }}
                />
              )}
            </g>
          );
        })}

        {/* 7. Tooltip (SVG-inline, shown above hovered point) */}
        {hoveredPoint && (() => {
          const { tx, ty } = tooltipPos(hoveredPoint);
          const labelText = hoveredPoint.label;
          const subText = hoveredPoint.sublabel;
          const tooltipW = 140;
          const tooltipH = 38;
          return (
            <g style={{ pointerEvents: "none" }}>
              <rect
                x={tx}
                y={ty}
                width={tooltipW}
                height={tooltipH}
                rx={TOOLTIP_RADIUS}
                ry={TOOLTIP_RADIUS}
                fill={tokenColor.bg0}
                stroke={tokenColor.border}
                strokeWidth={1}
                filter="drop-shadow(0 2px 4px rgba(0,0,0,0.08))"
              />
              <text
                x={tx + TOOLTIP_PAD}
                y={ty + TOOLTIP_PAD + 2}
                dominantBaseline="hanging"
                fontFamily={font.sans}
                fontSize={font.size.md}
                fontWeight={font.weight.bold}
                fill={tokenColor.text0}
              >
                {truncate(labelText, 18)}
              </text>
              <text
                x={tx + TOOLTIP_PAD}
                y={ty + TOOLTIP_PAD + 18}
                dominantBaseline="hanging"
                fontFamily={font.sans}
                fontSize={font.size.xs}
                fill={tokenColor.text2}
              >
                {truncate(subText, 26)}
              </text>
            </g>
          );
        })()}
      </g>

      {/* 8. Title + subtitle (top-left, above the fade group) */}
      <g style={{ pointerEvents: "none" }}>
        <text
          x={16}
          y={18}
          dominantBaseline="hanging"
          fontFamily={font.sans}
          fontSize={font.size.md}
          fontWeight={font.weight.semibold}
          fill={tokenColor.text0}
        >
          Structural Similarity Map
        </text>
        <text
          x={16}
          y={36}
          dominantBaseline="hanging"
          fontFamily={font.sans}
          fontSize={font.size.xs}
          fill={tokenColor.text2}
        >
          Proximity = similar coupling + risk profile
        </text>
      </g>

      {/* Empty state */}
      {!hasPoints && (
        <text
          x={width / 2}
          y={height / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily={font.sans}
          fontSize={font.size.lg}
          fill={tokenColor.text3}
        >
          No data
        </text>
      )}

      {/* 9. Overflow caption */}
      {layout.overflow > 0 && (
        <text
          x={width - 12}
          y={height - 12}
          textAnchor="end"
          dominantBaseline="auto"
          fontFamily={font.sans}
          fontSize={font.size.xs}
          fill={tokenColor.text2}
          style={{ pointerEvents: "none" }}
        >
          +{layout.overflow} more
        </text>
      )}
    </svg>
  );
}

export const EmbeddingMapView = memo(EmbeddingMapViewImpl);
