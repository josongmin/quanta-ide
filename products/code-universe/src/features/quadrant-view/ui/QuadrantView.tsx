// QuadrantView — SVG scatter plot for the Churn × Risk quadrant view.
// --------------------------------------------------------------------
// Consumes a QuadrantLayout and renders onto an SVG. Follows the same
// structure as ChordView: backdrop rect → quadrant regions → axes →
// divider lines → scatter dots. z-order (back to front):
//   1. Backdrop (full SVG, transparent — captures click-outside)
//   2. Quadrant region fills
//   3. Divider lines
//   4. Axis tick marks and labels
//   5. Scatter dots (large radius first — painters algorithm)
//   6. Hover tooltip
//
// Interactions:
//   - Hover dot: dim other dots to 0.2, highlight hovered with stroke
//     ring + show tooltip.
//   - Click dot: onFocusEntity(point.id).
//   - Click backdrop: onDismiss().
//
// Entry animation: root <g> fades opacity 0→1 over 280ms (two-rAF
// pattern from ChordView so the initial paint has opacity=0 before the
// CSS transition fires).

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, MouseEvent } from "react";
import { color as tokenColor, font } from "../../../shared/ui/tokens";
import type { QuadrantLayout } from "../model/types";

export interface QuadrantViewProps {
  layout: QuadrantLayout;
  width: number;
  height: number;
  onFocusEntity?: (id: string) => void;
  onDismiss?: () => void;
}

// ── Layout constants ──────────────────────────────────────────────────
const PAD_LEFT   = 60;  // Y axis label + tick marks
const PAD_RIGHT  = 40;
const PAD_TOP    = 40;
const PAD_BOTTOM = 60;  // X axis label

const TICK_COUNT = 4;  // 0%, 25%, 50%, 75% ticks (100% is implied by the axis line)
const TICK_LEN   = 5;  // px, length of the tick mark line
const ENTRY_MS   = 280;

// ── Tooltip size hint (fixed width, dynamic height) ───────────────────
const TOOLTIP_W  = 148;
const TOOLTIP_H  = 44;
const TOOLTIP_PAD = 6;

// ── Helpers ───────────────────────────────────────────────────────────

/** Map a normalized 0..1 value to SVG x-coordinate inside the plot. */
function toSvgX(norm: number, plotX: number, plotW: number): number {
  return plotX + norm * plotW;
}

/** Map a normalized 0..1 value to SVG y-coordinate inside the plot.
 *  Y=0 (low risk) maps to the bottom; Y=1 (high risk) maps to the top,
 *  which in SVG coordinates is a lower y value. */
function toSvgY(norm: number, plotY: number, plotH: number): number {
  return plotY + (1 - norm) * plotH;
}

// ── Component ─────────────────────────────────────────────────────────

function QuadrantViewImpl({
  layout,
  width,
  height,
  onFocusEntity,
  onDismiss,
}: QuadrantViewProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  // Track mouse position relative to SVG for tooltip placement.
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Fade-in on mount — two-rAF so the initial paint has opacity=0 before
  // the CSS transition fires (matches ChordView pattern).
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

  // Plot area bounds.
  const plotX = PAD_LEFT;
  const plotY = PAD_TOP;
  const plotW = Math.max(1, width  - PAD_LEFT - PAD_RIGHT);
  const plotH = Math.max(1, height - PAD_TOP  - PAD_BOTTOM);

  // Sort points large-radius first (painters algorithm) so small dots
  // appear on top of large ones.
  const sortedPoints = useMemo(
    () => [...layout.points].sort((a, b) => b.radius - a.radius),
    [layout.points],
  );

  const hoveredPoint = useMemo(
    () => (hoveredId ? layout.points.find(p => p.id === hoveredId) ?? null : null),
    [hoveredId, layout.points],
  );

  // ── Event handlers ──────────────────────────────────────────────────

  const handleBackdropClick = useCallback(() => {
    onDismiss?.();
  }, [onDismiss]);

  const handleCircleMouseEnter = useCallback(
    (e: MouseEvent<SVGCircleElement>, id: string) => {
      setHoveredId(id);
      if (svgRef.current) {
        const svgRect = svgRef.current.getBoundingClientRect();
        setTooltipPos({
          x: e.clientX - svgRect.left,
          y: e.clientY - svgRect.top,
        });
      }
    },
    [],
  );

  const handleCircleMouseMove = useCallback(
    (e: MouseEvent<SVGCircleElement>) => {
      if (svgRef.current) {
        const svgRect = svgRef.current.getBoundingClientRect();
        setTooltipPos({
          x: e.clientX - svgRect.left,
          y: e.clientY - svgRect.top,
        });
      }
    },
    [],
  );

  const handleCircleMouseLeave = useCallback(() => {
    setHoveredId(null);
    setTooltipPos(null);
  }, []);

  const handleCircleClick = useCallback(
    (id: string) => {
      onFocusEntity?.(id);
    },
    [onFocusEntity],
  );

  // ── Derived tooltip position — clamped to SVG bounds ────────────────
  const tooltip = useMemo(() => {
    if (!hoveredPoint || !tooltipPos) return null;
    const rawX = tooltipPos.x + 12;
    const rawY = tooltipPos.y - TOOLTIP_H / 2;
    const clampedX = Math.min(rawX, width  - TOOLTIP_W - 4);
    const clampedY = Math.max(4, Math.min(rawY, height - TOOLTIP_H - 4));
    return { x: clampedX, y: clampedY, point: hoveredPoint };
  }, [hoveredPoint, tooltipPos, width, height]);

  // ── Root group style (fade-in) ───────────────────────────────────────
  const rootStyle: CSSProperties = {
    opacity: mounted ? 1 : 0,
    transition: `opacity ${ENTRY_MS}ms ease-out`,
  };

  // ── Tick values for axes (0, 0.25, 0.5, 0.75 — i.e. TICK_COUNT ticks
  //    before the 1.0 endpoint which is the axis corner itself) ─────────
  const ticks = Array.from({ length: TICK_COUNT + 1 }, (_, i) => i / TICK_COUNT);

  // ── Empty state ──────────────────────────────────────────────────────
  const isEmpty = layout.points.length === 0;

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: "block", userSelect: "none", background: "transparent" }}
      role="img"
      aria-label="Churn × Risk quadrant scatter plot"
    >
      {/* Backdrop — captures click-outside to dismiss. */}
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
        {/* ── Quadrant region backgrounds ──────────────────────────── */}
        {layout.regions.map(region => {
          const rx = region.xHalf === 0 ? plotX : plotX + plotW / 2;
          // yHalf=1 = top half of plot (high risk) = smaller SVG y value
          const ry = region.yHalf === 1 ? plotY : plotY + plotH / 2;
          return (
            <rect
              key={region.id}
              x={rx}
              y={ry}
              width={plotW / 2}
              height={plotH / 2}
              fill={region.fill}
            />
          );
        })}

        {/* ── Quadrant divider lines ────────────────────────────────── */}
        {/* Vertical divider at x=0.5 */}
        <line
          x1={plotX + plotW / 2}
          y1={plotY}
          x2={plotX + plotW / 2}
          y2={plotY + plotH}
          stroke={tokenColor.border}
          strokeWidth={1}
          strokeDasharray="4 4"
        />
        {/* Horizontal divider at y=0.5 */}
        <line
          x1={plotX}
          y1={plotY + plotH / 2}
          x2={plotX + plotW}
          y2={plotY + plotH / 2}
          stroke={tokenColor.border}
          strokeWidth={1}
          strokeDasharray="4 4"
        />

        {/* ── Plot area border ──────────────────────────────────────── */}
        <rect
          x={plotX}
          y={plotY}
          width={plotW}
          height={plotH}
          fill="none"
          stroke={tokenColor.border}
          strokeWidth={1}
        />

        {/* ── Quadrant region labels ────────────────────────────────── */}
        {layout.regions.map(region => {
          // Place label in the outer corner of each quadrant.
          const lx =
            region.xHalf === 1
              ? plotX + plotW - 6          // right-aligned in right half
              : plotX + 6;                  // left-aligned in left half
          const ly =
            region.yHalf === 1
              ? plotY + 14                  // near top in top half (high risk)
              : plotY + plotH / 2 + 14;     // near top of bottom half
          return (
            <text
              key={region.id}
              x={lx}
              y={ly}
              textAnchor={region.xHalf === 1 ? "end" : "start"}
              fontSize={font.size.sm}
              fontStyle="italic"
              fill={tokenColor.text2}
            >
              {region.label}
            </text>
          );
        })}

        {/* ── X-axis ticks and labels ───────────────────────────────── */}
        {ticks.map(t => {
          const tx = plotX + t * plotW;
          const label = `${Math.round(t * 100)}%`;
          return (
            <g key={`xtick-${t}`}>
              <line
                x1={tx}
                y1={plotY + plotH}
                x2={tx}
                y2={plotY + plotH + TICK_LEN}
                stroke={tokenColor.border}
                strokeWidth={1}
              />
              <text
                x={tx}
                y={plotY + plotH + TICK_LEN + 12}
                textAnchor="middle"
                fontSize={font.size.xxs}
                fill={tokenColor.text2}
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {label}
              </text>
            </g>
          );
        })}

        {/* ── Y-axis ticks and labels ───────────────────────────────── */}
        {ticks.map(t => {
          // t=0 is bottom (low risk), t=1 is top (high risk).
          const ty = plotY + (1 - t) * plotH;
          const label = `${Math.round(t * 100)}%`;
          return (
            <g key={`ytick-${t}`}>
              <line
                x1={plotX - TICK_LEN}
                y1={ty}
                x2={plotX}
                y2={ty}
                stroke={tokenColor.border}
                strokeWidth={1}
              />
              <text
                x={plotX - TICK_LEN - 4}
                y={ty + 3}
                textAnchor="end"
                fontSize={font.size.xxs}
                fill={tokenColor.text2}
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {label}
              </text>
            </g>
          );
        })}

        {/* ── X axis label ─────────────────────────────────────────── */}
        <text
          x={plotX + plotW / 2}
          y={height - 10}
          textAnchor="middle"
          fontSize={font.size.sm}
          fill={tokenColor.text2}
        >
          {layout.xAxisLabel}
        </text>

        {/* ── Y axis label (rotated) ────────────────────────────────── */}
        <text
          x={0}
          y={0}
          textAnchor="middle"
          fontSize={font.size.sm}
          fill={tokenColor.text2}
          transform={`translate(14, ${plotY + plotH / 2}) rotate(-90)`}
        >
          {layout.yAxisLabel}
        </text>

        {/* ── Empty state ───────────────────────────────────────────── */}
        {isEmpty && (
          <text
            x={plotX + plotW / 2}
            y={plotY + plotH / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={font.size.md}
            fill={tokenColor.text2}
          >
            No data — workspace still loading
          </text>
        )}

        {/* ── Scatter dots ─────────────────────────────────────────── */}
        {!isEmpty && sortedPoints.map(point => {
          const cx = toSvgX(point.x, plotX, plotW);
          const cy = toSvgY(point.y, plotY, plotH);
          const isHovered = hoveredId === point.id;
          const isDimmed  = hoveredId !== null && !isHovered;

          const opacity = isDimmed ? 0.2 : isHovered ? 1.0 : 0.8;

          return (
            <g key={point.id}>
              <circle
                cx={cx}
                cy={cy}
                r={point.radius}
                fill={point.color}
                opacity={opacity}
                stroke={isHovered ? tokenColor.text0 : "none"}
                strokeWidth={isHovered ? 2 : 0}
                style={{ cursor: onFocusEntity ? "pointer" : "default" }}
                onMouseEnter={e => handleCircleMouseEnter(e, point.id)}
                onMouseMove={handleCircleMouseMove}
                onMouseLeave={handleCircleMouseLeave}
                onClick={() => handleCircleClick(point.id)}
              />
            </g>
          );
        })}

        {/* ── Overflow indicator ────────────────────────────────────── */}
        {layout.overflow > 0 && (
          <text
            x={width - PAD_RIGHT}
            y={height - 8}
            textAnchor="end"
            fontSize={font.size.xs}
            fill={tokenColor.text2}
          >
            {`+${layout.overflow} more`}
          </text>
        )}

        {/* ── Hover tooltip ─────────────────────────────────────────── */}
        {tooltip !== null && (
          <g
            transform={`translate(${tooltip.x}, ${tooltip.y})`}
            pointerEvents="none"
          >
            <rect
              x={0}
              y={0}
              width={TOOLTIP_W}
              height={TOOLTIP_H}
              rx={4}
              ry={4}
              fill={tokenColor.bg1}
              stroke={tokenColor.border}
              strokeWidth={1}
            />
            <text
              x={TOOLTIP_PAD}
              y={TOOLTIP_PAD + 12}
              fontSize={font.size.md}
              fill={tokenColor.text0}
              fontWeight={font.weight.medium}
            >
              {tooltip.point.label}
            </text>
            <text
              x={TOOLTIP_PAD}
              y={TOOLTIP_PAD + 28}
              fontSize={font.size.xs}
              fill={tokenColor.text2}
            >
              {tooltip.point.sublabel}
            </text>
          </g>
        )}
      </g>
    </svg>
  );
}

export const QuadrantView = memo(QuadrantViewImpl);
