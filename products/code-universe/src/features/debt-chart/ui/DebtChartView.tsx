// DebtChartView — multi-line time-series SVG chart for technical debt metrics.
// --------------------------------------------------------------------
// Consumes a `DebtChartLayout` (pre-computed, origin-independent coords)
// and paints a stock-chart-style view where each series is a smooth
// polyline with a faint area fill under it.
//
// z-order inside the SVG:
//   1. Backdrop (transparent, full-size, captures click-outside)
//   2. Grid lines (horizontal)
//   3. Commit tick marks (vertical, very faint)
//   4. Area fills (per series, low opacity)
//   5. Series polylines (per series)
//   6. Hover cursor + intersection dots
//   7. Axes + labels
//   8. Legend (right side)
//   9. Title bar
//
// Entry animation: fade-in 280 ms.
// Hover: vertical cursor snaps to nearest snapshot; shows intersection
//        dots and a tooltip with all series values at that commit.

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, MouseEvent as ReactMouseEvent } from "react";
import { color as tokenColor, font } from "../../../shared/ui/tokens";
import type { DebtChartLayout, DebtSeries } from "../model/types";

export interface DebtChartViewProps {
  layout: DebtChartLayout;
  width: number;
  height: number;
  onDismiss?: () => void;
}

const ENTRY_MS = 280;

// ── Helpers ──────────────────────────────────────────────────────────

/** Format a unix-ms timestamp as "Jan '24" style. */
function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en", { month: "short", year: "2-digit" });
}

/** Format a raw metric value: integers stay whole, floats get 1 dp. */
function fmtRaw(raw: number): string {
  return Number.isInteger(raw) ? String(raw) : raw.toFixed(1);
}

/** Map a normalised (t, v) pair to SVG pixel coords. */
function toSvgPx(
  t: number,
  v: number,
  padLeft: number,
  padTop: number,
  plotWidth: number,
  plotHeight: number,
): { x: number; y: number } {
  return {
    x: padLeft + t * plotWidth,
    // Invert Y: higher value → lower y (top of chart)
    y: padTop + (1 - v) * plotHeight,
  };
}

/** Build the SVG `points` attribute string for a polyline. */
function buildPoints(
  series: DebtSeries,
  padLeft: number,
  padTop: number,
  plotWidth: number,
  plotHeight: number,
): string {
  return series.points
    .map(p => {
      const { x, y } = toSvgPx(p.t, p.v, padLeft, padTop, plotWidth, plotHeight);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

/** Build the SVG `points` for the area fill polygon (polyline + bottom close). */
function buildAreaPoints(
  series: DebtSeries,
  padLeft: number,
  padTop: number,
  padBottom: number,
  plotWidth: number,
  plotHeight: number,
  totalHeight: number,
): string {
  if (series.points.length === 0) return "";
  const bottomY = (totalHeight - padBottom).toFixed(2);
  const linePoints = series.points.map(p => {
    const { x, y } = toSvgPx(p.t, p.v, padLeft, padTop, plotWidth, plotHeight);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const firstX = (padLeft + (series.points[0]?.t ?? 0) * plotWidth).toFixed(2);
  const lastX  = (padLeft + (series.points[series.points.length - 1]?.t ?? 1) * plotWidth).toFixed(2);
  return `${firstX},${bottomY} ${linePoints.join(" ")} ${lastX},${bottomY}`;
}

// ── Component ────────────────────────────────────────────────────────

function DebtChartViewImpl({ layout, width, height, onDismiss }: DebtChartViewProps) {
  const [mounted, setMounted] = useState(false);
  // Index into layout.snapshots for the hovered commit (null = no hover).
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Fade-in on mount.
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

  const handleBackdropClick = useCallback(() => {
    onDismiss?.();
  }, [onDismiss]);

  // Mouse-move over the plot area: snap to nearest snapshot.
  const handleMouseMove = useCallback(
    (e: ReactMouseEvent<SVGSVGElement>) => {
      if (!layout.hasHistory || layout.snapshots.length === 0) return;
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      // Convert mouseX to t in 0..1
      const t = (mouseX - layout.padLeft) / layout.plotWidth;
      const clampedT = Math.max(0, Math.min(1, t));
      // Snap to nearest snapshot index.
      const N = layout.snapshots.length;
      const idx = N === 1 ? 0 : Math.round(clampedT * (N - 1));
      setHoveredIdx(Math.max(0, Math.min(N - 1, idx)));
    },
    [layout],
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredIdx(null);
  }, []);

  // ── Pre-compute X axis tick positions ────────────────────────────────
  const xAxisTicks = useMemo((): Array<{ x: number; label: string }> => {
    if (!layout.hasHistory || layout.snapshots.length === 0) return [];
    const N = layout.snapshots.length;
    const { padLeft, plotWidth, snapshots } = layout;

    if (N === 1) {
      const snap = snapshots[0]!;
      return [{ x: padLeft, label: fmtDate(snap.timestamp) }];
    }

    // Show up to 4 evenly spaced ticks.
    const tickCount = Math.min(4, N);
    const ticks: Array<{ x: number; label: string }> = [];
    for (let i = 0; i < tickCount; i++) {
      const frac = tickCount === 1 ? 0 : i / (tickCount - 1);
      const snapIdx = Math.round(frac * (N - 1));
      const snap = snapshots[snapIdx]!;
      const x = padLeft + frac * plotWidth;
      ticks.push({ x, label: fmtDate(snap.timestamp) });
    }
    return ticks;
  }, [layout]);

  // ── Hover tooltip data ────────────────────────────────────────────────
  const hoveredData = useMemo(() => {
    if (hoveredIdx === null || !layout.hasHistory) return null;
    const snap = layout.snapshots[hoveredIdx];
    if (!snap) return null;

    const seriesValues = layout.series.map(s => {
      const pt = s.points[hoveredIdx];
      return { label: s.label, color: s.color, raw: pt ? fmtRaw(pt.raw) : "–" };
    });

    // Cursor X in SVG space
    const N = layout.snapshots.length;
    const t = N === 1 ? 0 : hoveredIdx / (N - 1);
    const cursorX = layout.padLeft + t * layout.plotWidth;

    return { snap, seriesValues, cursorX };
  }, [hoveredIdx, layout]);

  // ── Y-axis percentage labels ─────────────────────────────────────────
  const yAxisLabels: Array<{ y: number; text: string }> = useMemo(() => {
    const { padTop, plotHeight } = layout;
    return [100, 75, 50, 25, 0].map(pct => ({
      y: padTop + (1 - pct / 100) * plotHeight,
      text: `${pct}%`,
    }));
  }, [layout]);

  const rootStyle: CSSProperties = {
    opacity: mounted ? 1 : 0,
    transition: `opacity ${ENTRY_MS}ms ease-out`,
  };

  // ── No-history empty state ────────────────────────────────────────────
  if (!layout.hasHistory) {
    const cx = width / 2;
    const cy = height / 2;
    return (
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ display: "block", userSelect: "none", background: "transparent" }}
        role="img"
        aria-label="Debt Trajectory Chart — no history available"
      >
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
          <text
            x={cx}
            y={cy - 12}
            textAnchor="middle"
            fill={tokenColor.text2}
            fontSize={14}
            fontFamily={font.sans}
            fontStyle="italic"
          >
            No commit history available
          </text>
          <text
            x={cx}
            y={cy + 10}
            textAnchor="middle"
            fill={tokenColor.text2}
            fontSize={14}
            fontFamily={font.sans}
            fontStyle="italic"
          >
            Connect a git history source to see debt over time.
          </text>
        </g>
      </svg>
    );
  }

  // ── All-zeros "no debt" badge ────────────────────────────────────────
  const allZeros =
    layout.series.length > 0 &&
    layout.series.every(s => s.currentValue === 0 && s.delta === 0);

  const { padLeft, padTop, padRight: _padRight, padBottom, plotWidth, plotHeight } = layout;
  const plotRight  = padLeft + plotWidth;
  const plotBottom = padTop  + plotHeight;

  // Grid-line Y positions (0%, 25%, 50%, 75%, 100% of plotHeight).
  const gridYs = [0, 0.25, 0.5, 0.75, 1].map(frac => padTop + frac * plotHeight);

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: "block", userSelect: "none", background: "transparent" }}
      role="img"
      aria-label="Debt Trajectory Chart"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Backdrop */}
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
        {/* ── Title ─────────────────────────────────────────────────── */}
        <text
          x={padLeft}
          y={14}
          fill={tokenColor.text0}
          fontSize={font.size.lg}
          fontFamily={font.sans}
          fontWeight={font.weight.bold}
        >
          Debt Trajectory
        </text>
        <text
          x={padLeft + 108}
          y={14}
          fill={tokenColor.text2}
          fontSize={font.size.xs}
          fontFamily={font.sans}
        >
          {layout.snapshotCount} commits
        </text>

        {/* ── Background grid ───────────────────────────────────────── */}
        {gridYs.map((gy, i) => (
          <line
            key={i}
            x1={padLeft}
            y1={gy}
            x2={plotRight}
            y2={gy}
            stroke={tokenColor.border}
            strokeOpacity={0.4}
            strokeDasharray="4,4"
          />
        ))}

        {/* ── Commit tick marks (very faint verticals) ─────────────── */}
        {layout.snapshots.map((snap, i) => {
          const N = layout.snapshots.length;
          const t = N === 1 ? 0 : i / (N - 1);
          const x = padLeft + t * plotWidth;
          return (
            <line
              key={snap.sha}
              x1={x}
              y1={padTop}
              x2={x}
              y2={plotBottom}
              stroke={tokenColor.border}
              strokeOpacity={0.2}
            />
          );
        })}

        {/* ── Area fills (behind lines) ─────────────────────────────── */}
        {layout.series.map(s => {
          const pts = buildAreaPoints(s, padLeft, padTop, padBottom, plotWidth, plotHeight, height);
          if (!pts) return null;
          return (
            <polygon
              key={`area-${s.key}`}
              points={pts}
              fill={s.color}
              fillOpacity={0.08}
              stroke="none"
            />
          );
        })}

        {/* ── Series polylines ──────────────────────────────────────── */}
        {layout.series.map(s => {
          const pts = buildPoints(s, padLeft, padTop, plotWidth, plotHeight);
          return (
            <polyline
              key={`line-${s.key}`}
              points={pts}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          );
        })}

        {/* ── Hover cursor ──────────────────────────────────────────── */}
        {hoveredData !== null && (
          <>
            {/* Vertical cursor line */}
            <line
              x1={hoveredData.cursorX}
              y1={padTop}
              x2={hoveredData.cursorX}
              y2={plotBottom}
              stroke={tokenColor.text2}
              strokeOpacity={0.5}
              strokeWidth={1}
              strokeDasharray="3,3"
            />

            {/* Intersection dots */}
            {layout.series.map(s => {
              const pt = s.points[hoveredIdx!];
              if (!pt) return null;
              const { x, y } = toSvgPx(pt.t, pt.v, padLeft, padTop, plotWidth, plotHeight);
              return (
                <circle
                  key={`dot-${s.key}`}
                  cx={x}
                  cy={y}
                  r={5}
                  fill={s.color}
                  stroke="#ffffff"
                  strokeWidth={1.5}
                />
              );
            })}

            {/* Tooltip */}
            {(() => {
              const tipW = 130;
              const tipH = 12 + layout.series.length * 16 + 8;
              // Place tooltip to the right of the cursor; flip if near right edge.
              const tipX =
                hoveredData.cursorX + 10 + tipW > plotRight
                  ? hoveredData.cursorX - tipW - 10
                  : hoveredData.cursorX + 10;
              const tipY = padTop + 4;

              return (
                <g transform={`translate(${tipX},${tipY})`}>
                  <rect
                    x={0}
                    y={0}
                    width={tipW}
                    height={tipH}
                    rx={4}
                    fill="#ffffff"
                    stroke={tokenColor.border}
                    strokeWidth={1}
                    filter="drop-shadow(0 2px 6px rgba(0,0,0,0.08))"
                  />
                  <text
                    x={8}
                    y={12}
                    fill={tokenColor.text2}
                    fontSize={font.size.xxs}
                    fontFamily={font.sans}
                  >
                    {fmtDate(hoveredData.snap.timestamp)}
                  </text>
                  {hoveredData.seriesValues.map((sv, i) => (
                    <g key={sv.label} transform={`translate(8, ${20 + i * 16})`}>
                      <rect x={0} y={-7} width={12} height={3} rx={1} fill={sv.color} />
                      <text
                        x={16}
                        y={0}
                        fill={tokenColor.text1}
                        fontSize={font.size.xxs}
                        fontFamily={font.sans}
                      >
                        {sv.label}:{" "}
                        <tspan fontWeight={font.weight.semibold}>{sv.raw}</tspan>
                      </text>
                    </g>
                  ))}
                </g>
              );
            })()}
          </>
        )}

        {/* ── Y axis labels ─────────────────────────────────────────── */}
        {yAxisLabels.map(({ y, text }) => (
          <text
            key={text}
            x={padLeft - 6}
            y={y + 4}
            textAnchor="end"
            fill={tokenColor.text2}
            fontSize={font.size.xxs}
            fontFamily={font.sans}
          >
            {text}
          </text>
        ))}

        {/* ── X axis labels ─────────────────────────────────────────── */}
        {xAxisTicks.map(({ x, label }) => (
          <text
            key={label}
            x={x}
            y={plotBottom + 16}
            textAnchor="middle"
            fill={tokenColor.text2}
            fontSize={font.size.xxs}
            fontFamily={font.sans}
          >
            {label}
          </text>
        ))}

        {/* ── Legend (right side) ───────────────────────────────────── */}
        {layout.series.map((s, i) => {
          const lx = plotRight + 16;
          const ly = padTop + i * 20;
          const isDebt = s.isDebtMetric;
          const deltaUp = s.delta > 0;
          const deltaDown = s.delta < 0;

          // Arrow + delta text
          let arrowChar = "";
          let arrowColor: string = tokenColor.text2;
          if (deltaUp) {
            arrowChar = "▲";
            arrowColor = isDebt ? tokenColor.danger : tokenColor.text2;
          } else if (deltaDown) {
            arrowChar = "▼";
            arrowColor = isDebt ? tokenColor.success : tokenColor.text2;
          }

          const deltaAbs = Math.abs(s.delta);
          const deltaStr = deltaAbs === 0 ? "" : ` ${arrowChar}${fmtRaw(deltaAbs)}`;

          return (
            <g key={`legend-${s.key}`}>
              {/* Colored dash */}
              <line
                x1={lx}
                y1={ly + 6}
                x2={lx + 16}
                y2={ly + 6}
                stroke={s.color}
                strokeWidth={2.5}
                strokeLinecap="round"
              />
              {/* Label */}
              <text
                x={lx + 20}
                y={ly + 10}
                fill={tokenColor.text1}
                fontSize={font.size.sm}
                fontFamily={font.sans}
              >
                {s.label}
              </text>
              {/* Current value (bold) */}
              <text
                x={lx + 20}
                y={ly + 10}
                fill={tokenColor.text0}
                fontSize={font.size.sm}
                fontFamily={font.sans}
                fontWeight={font.weight.bold}
                dx={s.label.length * 6.2}
              >
                {" "}{fmtRaw(s.currentValue)}
              </text>
              {/* Delta arrow */}
              {deltaStr !== "" && (
                <text
                  x={lx + 20}
                  y={ly + 10}
                  fill={arrowColor}
                  fontSize={font.size.xxs}
                  fontFamily={font.sans}
                  dx={(s.label.length * 6.2) + 22}
                >
                  {deltaStr}
                </text>
              )}
            </g>
          );
        })}

        {/* ── "No debt found" zero-state badge ─────────────────────── */}
        {allZeros && (
          <g transform={`translate(${padLeft + plotWidth / 2 - 52}, ${padTop + plotHeight / 2 - 10})`}>
            <rect
              x={0}
              y={0}
              width={104}
              height={22}
              rx={11}
              fill={tokenColor.success}
              fillOpacity={0.12}
            />
            <text
              x={52}
              y={15}
              textAnchor="middle"
              fill={tokenColor.success}
              fontSize={font.size.sm}
              fontFamily={font.sans}
              fontWeight={font.weight.semibold}
            >
              No debt found
            </text>
          </g>
        )}
      </g>
    </svg>
  );
}

export const DebtChartView = memo(DebtChartViewImpl);
