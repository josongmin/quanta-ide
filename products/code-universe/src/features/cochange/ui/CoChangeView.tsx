// CoChangeView — SVG matrix heatmap of co-change coupling.
// --------------------------------------------------------------------
// Renders an N×N grid (N ≤ 15) where intensity encodes how frequently
// each file pair changed together across snapshot history.
//
// Layout:
//   - Y-axis labels on the left (file names, right-aligned).
//   - X-axis labels rotated 45° along the top.
//   - Cell grid: intensity = ratio (0 = white, 1 = #3b82f6).
//   - Diagonal cells: grey bg (file with itself — not meaningful).
//   - Color scale legend strip at bottom-right.
//   - Hover: highlights full row + column, shows tooltip.
//
// Empty states:
//   - No history data  → text message.
//   - History present but no co-change → "No co-change detected".
//
// Entry animation: fade-in 240 ms.

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { color as tokenColor, font } from "../../../shared/ui/tokens";
import { buildCoChangeLayout } from "../model/build-cochange-layout";
import type { CoChangeLayout } from "../model/types";
import type { WorkspaceGraph } from "@quanta/canvas-engine";

// ── Props ─────────────────────────────────────────────────────────────

export interface CoChangeViewProps {
  graph: WorkspaceGraph;
  onFocusEntity?: (id: string) => void;
  onDismiss?: () => void;
}

// ── Constants ─────────────────────────────────────────────────────────

const ENTRY_MS = 240;
const LABEL_X_WIDTH = 110;   // space reserved for Y-axis labels (px)
const LABEL_Y_HEIGHT = 110;  // space reserved for X-axis labels (rotated, px)
const CELL_MIN = 12;
const CELL_MAX = 36;
const LEGEND_W = 80;
const LEGEND_H = 10;
const PAD_BOTTOM = 28;       // below legend
const PAD_RIGHT = 16;

// ── Helpers ───────────────────────────────────────────────────────────

/** Truncate a file name to fit inside the label column. */
function truncate(name: string, maxChars: number): string {
  if (name.length <= maxChars) return name;
  return `…${name.slice(-(maxChars - 1))}`;
}

/** Build a cell-lookup key. */
function cellKey(ai: number, bi: number): string {
  return `${ai}:${bi}`;
}

/** Format a ratio as a percentage string. */
function fmtPct(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

/** Lerp color same as model helper (duplicated to avoid cross-slice import). */
function lerpColor(ratio: number): string {
  const t = Math.max(0, Math.min(1, ratio));
  const r = Math.round(255 + (59  - 255) * t);
  const g = Math.round(255 + (130 - 255) * t);
  const b = Math.round(255 + (246 - 255) * t);
  return `rgb(${r},${g},${b})`;
}

// ── Inner SVG content ─────────────────────────────────────────────────

interface MatrixContentProps {
  layout: CoChangeLayout;
  width: number;
  height: number;
  onFocusEntity?: (id: string) => void;
}

function MatrixContent({ layout, width, height, onFocusEntity }: MatrixContentProps) {
  const [hovered, setHovered] = useState<{ ai: number; bi: number } | null>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    text: string[];
  } | null>(null);

  const N = layout.fileOrder.length;
  if (N === 0) return null;

  // ── Cell sizing ──────────────────────────────────────────────────
  const availW = width  - LABEL_X_WIDTH - PAD_RIGHT  - LEGEND_W - 16;
  const availH = height - LABEL_Y_HEIGHT - PAD_BOTTOM;
  const rawCell = Math.min(CELL_MAX, Math.max(CELL_MIN, Math.floor(Math.min(availW, availH) / N)));
  const cellSize = rawCell;

  const gridLeft = LABEL_X_WIDTH;
  const gridTop  = LABEL_Y_HEIGHT;

  // Build sparse cell lookup (upper-triangle).
  const cellLookup = useMemo(() => {
    const m = new Map<string, (typeof layout.cells)[number]>();
    for (const c of layout.cells) {
      const ai = layout.fileOrder.indexOf(c.fileA);
      const bi = layout.fileOrder.indexOf(c.fileB);
      if (ai >= 0 && bi >= 0) {
        m.set(cellKey(ai, bi), c);
        m.set(cellKey(bi, ai), c); // symmetric
      }
    }
    return m;
  }, [layout]);

  // ── Interaction ──────────────────────────────────────────────────
  const handleCellEnter = useCallback(
    (ai: number, bi: number, cx: number, cy: number) => {
      if (ai === bi) {
        setHovered(null);
        setTooltip(null);
        return;
      }
      setHovered({ ai, bi });
      const cell = cellLookup.get(cellKey(ai, bi));
      if (cell) {
        const lines = [
          `${cell.nameA}  ↔  ${cell.nameB}`,
          `Changed together: ${cell.cochangeCount}/${cell.totalSnapshots} (${fmtPct(cell.ratio)})`,
        ];
        // Position tooltip to the right; flip if near right edge.
        const tipX = cx + cellSize + 4 > width - 160 ? cx - 164 : cx + cellSize + 4;
        setTooltip({ x: tipX, y: cy, text: lines });
      } else {
        setTooltip(null);
      }
    },
    [cellLookup, cellSize, width],
  );

  const handleCellLeave = useCallback(() => {
    setHovered(null);
    setTooltip(null);
  }, []);

  const handleCellClick = useCallback(
    (ai: number, bi: number) => {
      if (!onFocusEntity || ai === bi) return;
      onFocusEntity(layout.fileOrder[ai]!);
    },
    [onFocusEntity, layout.fileOrder],
  );

  // ── Render ───────────────────────────────────────────────────────
  const cells: React.ReactNode[] = [];

  for (let ai = 0; ai < N; ai++) {
    for (let bi = 0; bi < N; bi++) {
      const cx = gridLeft + bi * cellSize;
      const cy = gridTop  + ai * cellSize;

      const isHovRow = hovered !== null && hovered.ai === ai;
      const isHovCol = hovered !== null && hovered.bi === bi;
      const isHovered = hovered !== null && hovered.ai === ai && hovered.bi === bi;
      const isDiag = ai === bi;

      let fillColor: string;
      if (isDiag) {
        fillColor = tokenColor.bg3;
      } else {
        const cell = cellLookup.get(cellKey(ai, bi));
        fillColor = cell ? cell.color : "#ffffff";
      }

      // Highlight row/col on hover with a light tint overlay.
      const highlightOpacity = (isHovRow || isHovCol) && !isDiag ? 0.15 : 0;

      const ai_ = ai;
      const bi_ = bi;

      cells.push(
        <g key={`cell-${ai_}-${bi_}`}>
          <rect
            x={cx}
            y={cy}
            width={cellSize - 1}
            height={cellSize - 1}
            rx={1}
            fill={fillColor}
            stroke={tokenColor.border}
            strokeWidth={0.5}
            style={{ cursor: !isDiag && onFocusEntity ? "pointer" : "default" }}
            onMouseEnter={() => handleCellEnter(ai_, bi_, cx, cy)}
            onMouseLeave={handleCellLeave}
            onClick={() => handleCellClick(ai_, bi_)}
          />
          {/* Hover highlight overlay */}
          {highlightOpacity > 0 && (
            <rect
              x={cx}
              y={cy}
              width={cellSize - 1}
              height={cellSize - 1}
              rx={1}
              fill="#0d99ff"
              fillOpacity={highlightOpacity}
              pointerEvents="none"
            />
          )}
          {/* Active cell border */}
          {isHovered && !isDiag && (
            <rect
              x={cx}
              y={cy}
              width={cellSize - 1}
              height={cellSize - 1}
              rx={1}
              fill="none"
              stroke="#0d99ff"
              strokeWidth={1.5}
              pointerEvents="none"
            />
          )}
        </g>,
      );
    }
  }

  // ── Y-axis labels ─────────────────────────────────────────────────
  const yLabels: React.ReactNode[] = layout.fileNames.map((name, ai) => {
    const cy = gridTop + ai * cellSize + cellSize / 2;
    const isActive = hovered?.ai === ai;
    return (
      <text
        key={`ylabel-${ai}`}
        x={LABEL_X_WIDTH - 6}
        y={cy + 1}
        textAnchor="end"
        dominantBaseline="middle"
        fill={isActive ? tokenColor.text0 : tokenColor.text2}
        fontSize={Math.max(font.size.xxs, Math.min(font.size.xs, cellSize - 2))}
        fontFamily={font.mono}
        fontWeight={isActive ? font.weight.semibold : font.weight.regular}
      >
        {truncate(name, 16)}
      </text>
    );
  });

  // ── X-axis labels (rotated) ───────────────────────────────────────
  const xLabels: React.ReactNode[] = layout.fileNames.map((name, bi) => {
    const cx = gridLeft + bi * cellSize + cellSize / 2;
    const isActive = hovered?.bi === bi;
    return (
      <text
        key={`xlabel-${bi}`}
        x={cx}
        y={LABEL_Y_HEIGHT - 6}
        textAnchor="start"
        dominantBaseline="auto"
        fill={isActive ? tokenColor.text0 : tokenColor.text2}
        fontSize={Math.max(font.size.xxs, Math.min(font.size.xs, cellSize - 2))}
        fontFamily={font.mono}
        fontWeight={isActive ? font.weight.semibold : font.weight.regular}
        transform={`rotate(-45, ${cx}, ${LABEL_Y_HEIGHT - 6})`}
      >
        {truncate(name, 16)}
      </text>
    );
  });

  // ── Color scale legend ────────────────────────────────────────────
  const legendX = gridLeft + N * cellSize + 16;
  const legendY = gridTop + N * cellSize / 2 - LEGEND_H / 2;

  // Build gradient stops for a horizontal legend strip.
  const legendStops = Array.from({ length: 5 }, (_, i) => {
    const t = i / 4;
    return { offset: `${t * 100}%`, color: lerpColor(t) };
  });

  const legendId = "cochange-legend-grad";

  const legendEl = (
    <g key="legend">
      <defs>
        <linearGradient id={legendId} x1="0" y1="0" x2="0" y2="1">
          {legendStops.map(s => (
            <stop key={s.offset} offset={s.offset} stopColor={s.color} />
          ))}
        </linearGradient>
      </defs>
      <rect
        x={legendX}
        y={legendY}
        width={LEGEND_H}
        height={LEGEND_W}
        rx={2}
        fill={`url(#${legendId})`}
        stroke={tokenColor.border}
        strokeWidth={0.5}
      />
      <text
        x={legendX + LEGEND_H + 4}
        y={legendY}
        dominantBaseline="hanging"
        fill={tokenColor.text3}
        fontSize={font.size.xxs}
        fontFamily={font.sans}
      >
        100%
      </text>
      <text
        x={legendX + LEGEND_H + 4}
        y={legendY + LEGEND_W}
        dominantBaseline="auto"
        fill={tokenColor.text3}
        fontSize={font.size.xxs}
        fontFamily={font.sans}
      >
        0%
      </text>
    </g>
  );

  // ── Tooltip ───────────────────────────────────────────────────────
  const tipEl = tooltip && (
    <g key="tooltip" transform={`translate(${tooltip.x},${tooltip.y})`}>
      {(() => {
        const tipW = 168;
        const lineH = 14;
        const tipH = 10 + tooltip.text.length * lineH;
        return (
          <>
            <rect
              x={0}
              y={0}
              width={tipW}
              height={tipH}
              rx={4}
              fill="#ffffff"
              stroke={tokenColor.border}
              strokeWidth={1}
              filter="drop-shadow(0 2px 6px rgba(0,0,0,0.09))"
            />
            {tooltip.text.map((line, i) => (
              <text
                key={i}
                x={8}
                y={11 + i * lineH}
                fill={i === 0 ? tokenColor.text0 : tokenColor.text2}
                fontSize={i === 0 ? font.size.xs : font.size.xxs}
                fontFamily={font.sans}
                fontWeight={i === 0 ? font.weight.semibold : font.weight.regular}
              >
                {line}
              </text>
            ))}
          </>
        );
      })()}
    </g>
  );

  return (
    <>
      {cells}
      {yLabels}
      {xLabels}
      {legendEl}
      {tipEl}
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────

function CoChangeViewImpl({ graph, onFocusEntity, onDismiss }: CoChangeViewProps) {
  const [mounted, setMounted] = useState(false);
  const [size, setSize] = useState({ width: 560, height: 500 });
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Dismiss on Escape.
  useEffect(() => {
    if (!onDismiss) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onDismiss]);

  // Observe container size.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry) {
        setSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    ro.observe(el);
    // Initial read.
    setSize({ width: el.offsetWidth, height: el.offsetHeight });
    return () => ro.disconnect();
  }, []);

  const layout = useMemo(
    () => buildCoChangeLayout({ graph }),
    [graph],
  );

  // ── Styles ────────────────────────────────────────────────────────
  const rootStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    width: "100%",
    height: "100%",
    backgroundColor: tokenColor.bg1,
    borderRadius: 6,
    overflow: "hidden",
    opacity: mounted ? 1 : 0,
    transition: `opacity ${ENTRY_MS}ms ease-out`,
    fontFamily: font.sans,
  };

  const headerStyle: CSSProperties = {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    padding: `10px 16px`,
    borderBottom: `1px solid ${tokenColor.border}`,
    gap: 8,
    flexShrink: 0,
  };

  const titleStyle: CSSProperties = {
    fontSize: font.size.lg,
    fontWeight: font.weight.bold,
    color: tokenColor.text0,
    fontFamily: font.sans,
  };

  const subtitleStyle: CSSProperties = {
    fontSize: font.size.xs,
    color: tokenColor.text2,
    fontFamily: font.sans,
  };

  const dismissBtnStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 22,
    height: 22,
    borderRadius: 4,
    border: "none",
    backgroundColor: "transparent",
    color: tokenColor.text2,
    fontSize: font.size.md,
    cursor: "pointer",
    padding: 0,
    flexShrink: 0,
  };

  // ── Empty states ──────────────────────────────────────────────────
  const renderEmptyState = (msg: string) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flex: 1,
        color: tokenColor.text2,
        fontSize: font.size.md,
        fontStyle: "italic",
        fontFamily: font.sans,
      }}
    >
      {msg}
    </div>
  );

  const showEmpty = !layout.hasHistory || layout.fileOrder.length === 0;

  const snapshotInfo = layout.hasHistory
    ? `${layout.fileOrder.length} files · ${layout.totalSnapshots} snapshot pairs`
    : "";

  return (
    <div style={rootStyle} role="region" aria-label="Co-change Network">
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <span style={titleStyle}>Co-change Network</span>
          <span style={subtitleStyle}>
            {layout.hasHistory ? snapshotInfo : "files that change together"}
          </span>
        </div>
        {onDismiss && (
          <button
            style={dismissBtnStyle}
            onClick={onDismiss}
            aria-label="Close Co-change Network"
            title="Close"
          >
            ✕
          </button>
        )}
      </div>

      {/* Body */}
      {showEmpty ? (
        layout.hasHistory
          ? renderEmptyState("No co-change detected across snapshots")
          : renderEmptyState("No history data")
      ) : (
        <div
          ref={containerRef}
          style={{ flex: 1, overflow: "hidden", position: "relative" }}
        >
          <svg
            width={size.width}
            height={size.height}
            viewBox={`0 0 ${size.width} ${size.height}`}
            style={{ display: "block", userSelect: "none" }}
            role="img"
            aria-label="Co-change matrix heatmap"
          >
            {/* Title inside SVG for accessibility when used standalone */}
            <title>Co-change matrix heatmap</title>

            {/* Grid background */}
            <rect
              x={0}
              y={0}
              width={size.width}
              height={size.height}
              fill={tokenColor.bg1}
            />

            <MatrixContent
              layout={layout}
              width={size.width}
              height={size.height}
              onFocusEntity={onFocusEntity}
            />
          </svg>
        </div>
      )}
    </div>
  );
}

export const CoChangeView = memo(CoChangeViewImpl);
