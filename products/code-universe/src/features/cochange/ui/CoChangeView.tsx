// CoChangeView — SOTA++ split-layout co-change heatmap panel.
// --------------------------------------------------------------------
// Layout: matrix SVG (left 70%) + "Top Couplings" panel (right 30%).
//
// Matrix features:
//   - 10-stop color scale from color.bg1 (0) to #0d99ff (1.0)
//   - Strongly coupled (ratio > 0.7): 2px white cell border
//   - Diagonal cells: color.bg2 with subtle diagonal line pattern
//   - Row+column hover highlight: rgba(13,153,255,0.08) tint
//   - Cell hover tooltip: "A ↔ B changed together M/N times (ratio%)"
//
// Top Couplings panel:
//   - Top 5 pairs with ratio bars + percentage
//   - Click a pair to highlight that row+col in the matrix
//
// Bottom-right: horizontal gradient color scale legend
// Summary strip: file/snapshot counts + strongest coupling
//
// Entry animation: container fadeUp 250ms, matrix cells stagger by row.

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { color as tokenColor, font, radius, space, transition } from "../../../shared/ui/tokens";
import { buildCoChangeLayout } from "../model/build-cochange-layout";
import type { CoChangeLayout, CoChangeCell } from "../model/types";
import type { WorkspaceGraph } from "@quanta/canvas-engine";

// ── Props ─────────────────────────────────────────────────────────────

export interface CoChangeViewProps {
  graph: WorkspaceGraph;
  onFocusEntity?: (id: string) => void;
  onDismiss?: () => void;
}

// ── Constants ─────────────────────────────────────────────────────────

const ENTRY_MS     = 250;
const LABEL_X_W    = 108;  // Y-axis label column width
const LABEL_Y_H    = 108;  // X-axis label row height
const CELL_MIN     = 14;
const CELL_MAX     = 38;
const PAD_B        = 16;
const PAD_R        = 16;
const ACCENT       = "#0d99ff";
const STRONG_THR   = 0.7;

// ── Helpers ───────────────────────────────────────────────────────────

function truncate(name: string, max: number): string {
  if (name.length <= max) return name;
  return `…${name.slice(-(max - 1))}`;
}

function cellKey(ai: number, bi: number): string {
  return `${ai}:${bi}`;
}

function fmtPct(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

/** 10-stop color scale: bg1 (white) → #0d99ff */
function ratioColor(ratio: number): string {
  const t = Math.max(0, Math.min(1, ratio));
  const r = Math.round(255 + (13  - 255) * t);
  const g = Math.round(255 + (153 - 255) * t);
  const b = Math.round(255 + (255 - 255) * t);
  return `rgb(${r},${g},${b})`;
}

// ── Keyframes injection (once) ────────────────────────────────────────

let _kfInjected = false;
function injectKeyframes(): void {
  if (_kfInjected || typeof document === "undefined") return;
  _kfInjected = true;
  const el = document.createElement("style");
  el.textContent = `
    @keyframes _ccv-fadeUp {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes _ccv-cellIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
  `;
  document.head.appendChild(el);
}

// ── Top Couplings Panel ───────────────────────────────────────────────

interface TopCouplingsPanelProps {
  cells: CoChangeCell[];
  onSelectPair?: (ai: number, bi: number) => void;
  fileOrder: string[];
  selectedPair: { ai: number; bi: number } | null;
}

function TopCouplingsPanel({ cells, onSelectPair, fileOrder, selectedPair }: TopCouplingsPanelProps) {
  // Sort cells by ratio desc, take top 5
  const top5 = useMemo(() => {
    return [...cells]
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, 5);
  }, [cells]);

  const panelStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    width: "30%",
    flexShrink: 0,
    borderLeft: `1px solid ${tokenColor.border}`,
    backgroundColor: tokenColor.bg2,
    overflow: "hidden",
  };

  const panelTitleStyle: CSSProperties = {
    fontSize: font.size.xs,
    fontWeight: font.weight.semibold,
    fontFamily: font.sans,
    color: tokenColor.text1,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    padding: `${space[3]}px ${space[3]}px ${space[2]}px`,
    borderBottom: `1px solid ${tokenColor.border}`,
    flexShrink: 0,
  };

  const listStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 1,
    padding: `${space[2]}px`,
    flex: 1,
    overflow: "auto",
  };

  return (
    <div style={panelStyle}>
      <div style={panelTitleStyle}>Strongest Coupling</div>
      <div style={listStyle}>
        {top5.length === 0 ? (
          <span style={{ fontSize: font.size.xs, color: tokenColor.text2, fontFamily: font.sans, padding: `${space[2]}px` }}>
            No pairs
          </span>
        ) : (
          top5.map((cell, idx) => {
            const ai = fileOrder.indexOf(cell.fileA);
            const bi = fileOrder.indexOf(cell.fileB);
            const isSelected = selectedPair !== null &&
              ((selectedPair.ai === ai && selectedPair.bi === bi) ||
               (selectedPair.ai === bi && selectedPair.bi === ai));

            return (
              <CouplingRow
                key={`${cell.fileA}:${cell.fileB}`}
                cell={cell}
                rank={idx + 1}
                isSelected={isSelected}
                onSelect={() => onSelectPair?.(ai, bi)}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

function CouplingRow({
  cell,
  rank,
  isSelected,
  onSelect,
}: {
  cell: CoChangeCell;
  rank: number;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const pct = Math.round(cell.ratio * 100);

  const rowStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    padding: `${space[2]}px ${space[2]}px`,
    borderRadius: radius.sm,
    backgroundColor: isSelected
      ? tokenColor.accentSoft
      : hovered
      ? tokenColor.hover
      : "transparent",
    border: isSelected ? `1px solid ${tokenColor.accentBorder}` : "1px solid transparent",
    cursor: "pointer",
    transition: `background-color ${transition.fast}, border-color ${transition.fast}`,
  };

  const namesStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 4,
    fontSize: font.size.xs,
    fontFamily: font.mono,
    color: tokenColor.text0,
    overflow: "hidden",
  };

  const nameStyle: CSSProperties = {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    flex: 1,
    minWidth: 0,
  };

  const separatorStyle: CSSProperties = {
    color: ACCENT,
    fontFamily: font.sans,
    fontWeight: font.weight.semibold,
    flexShrink: 0,
    fontSize: font.size.xxs,
  };

  const barRowStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: space[1],
  };

  const trackStyle: CSSProperties = {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: tokenColor.bg3,
    overflow: "hidden",
  };

  const fillStyle: CSSProperties = {
    height: "100%",
    borderRadius: 2,
    backgroundColor: ACCENT,
    width: `${pct}%`,
    opacity: 0.7 + cell.ratio * 0.3,
  };

  const pctStyle: CSSProperties = {
    fontSize: font.size.xxs,
    fontFamily: font.sans,
    color: tokenColor.text2,
    fontWeight: font.weight.semibold,
    flexShrink: 0,
    width: 28,
    textAlign: "right",
  };

  const rankStyle: CSSProperties = {
    fontSize: font.size.xxs,
    fontFamily: font.sans,
    color: tokenColor.text3,
    flexShrink: 0,
  };

  return (
    <div
      style={rowStyle}
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onSelect(); }}
      aria-label={`${cell.nameA} and ${cell.nameB} coupled at ${pct}%`}
    >
      <div style={namesStyle}>
        <span style={{ ...rankStyle }}>{rank}.</span>
        <span style={nameStyle} title={cell.nameA}>{truncate(cell.nameA, 12)}</span>
        <span style={separatorStyle}>↔</span>
        <span style={nameStyle} title={cell.nameB}>{truncate(cell.nameB, 12)}</span>
      </div>
      <div style={barRowStyle}>
        <div style={trackStyle}>
          <div style={fillStyle} />
        </div>
        <span style={pctStyle}>{pct}%</span>
      </div>
    </div>
  );
}

// ── Matrix SVG ────────────────────────────────────────────────────────

interface MatrixPanelProps {
  layout: CoChangeLayout;
  width: number;
  height: number;
  onFocusEntity?: (id: string) => void;
  highlightPair: { ai: number; bi: number } | null;
  onCellClick?: (ai: number, bi: number) => void;
}

function MatrixPanel({
  layout,
  width,
  height,
  onFocusEntity,
  highlightPair,
  onCellClick,
}: MatrixPanelProps) {
  const [hovered, setHovered] = useState<{ ai: number; bi: number } | null>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    lines: string[];
  } | null>(null);

  const N = layout.fileOrder.length;

  // Cell sizing
  const availW = width  - LABEL_X_W - PAD_R;
  const availH = height - LABEL_Y_H - PAD_B;
  const cellSize = N > 0
    ? Math.min(CELL_MAX, Math.max(CELL_MIN, Math.floor(Math.min(availW, availH) / N)))
    : CELL_MIN;

  const gridLeft = LABEL_X_W;
  const gridTop  = LABEL_Y_H;

  // Build cell lookup (symmetric)
  const cellLookup = useMemo(() => {
    const m = new Map<string, CoChangeCell>();
    for (const c of layout.cells) {
      const ai = layout.fileOrder.indexOf(c.fileA);
      const bi = layout.fileOrder.indexOf(c.fileB);
      if (ai >= 0 && bi >= 0) {
        m.set(cellKey(ai, bi), c);
        m.set(cellKey(bi, ai), c);
      }
    }
    return m;
  }, [layout]);

  const handleCellEnter = useCallback(
    (ai: number, bi: number, cx: number, cy: number) => {
      if (ai === bi) { setHovered(null); setTooltip(null); return; }
      setHovered({ ai, bi });
      const cell = cellLookup.get(cellKey(ai, bi));
      if (cell) {
        const lines = [
          `${truncate(cell.nameA, 18)}  ↔  ${truncate(cell.nameB, 18)}`,
          `Changed together: ${cell.cochangeCount}/${cell.totalSnapshots} (${fmtPct(cell.ratio)})`,
        ];
        const tipW = 200;
        const tipX = cx + cellSize + 6 > width - tipW - 8 ? cx - tipW - 4 : cx + cellSize + 4;
        setTooltip({ x: tipX, y: Math.max(gridTop, cy - 4), lines });
      } else {
        setTooltip(null);
      }
    },
    [cellLookup, cellSize, width, gridTop],
  );

  const handleCellLeave = useCallback(() => {
    setHovered(null);
    setTooltip(null);
  }, []);

  const handleCellClick = useCallback(
    (ai: number, bi: number) => {
      if (ai === bi) return;
      onCellClick?.(ai, bi);
      onFocusEntity?.(layout.fileOrder[ai]!);
    },
    [onCellClick, onFocusEntity, layout.fileOrder],
  );

  if (N === 0) return null;

  // ── Build cells ──────────────────────────────────────────────────
  const cellEls: React.ReactNode[] = [];

  for (let ai = 0; ai < N; ai++) {
    for (let bi = 0; bi < N; bi++) {
      const cx = gridLeft + bi * cellSize;
      const cy = gridTop  + ai * cellSize;
      const isDiag = ai === bi;
      const isHovRow = hovered?.ai === ai;
      const isHovCol = hovered?.bi === bi;
      const isHovCell = hovered?.ai === ai && hovered?.bi === bi;
      const isHighlightRow = highlightPair !== null && (highlightPair.ai === ai || highlightPair.bi === ai);
      const isHighlightCol = highlightPair !== null && (highlightPair.ai === bi || highlightPair.bi === bi);
      const isHighlightCell = highlightPair !== null &&
        ((highlightPair.ai === ai && highlightPair.bi === bi) ||
         (highlightPair.ai === bi && highlightPair.bi === ai));

      const cell = !isDiag ? cellLookup.get(cellKey(ai, bi)) : undefined;
      const ratio = cell?.ratio ?? 0;
      const isStrong = ratio > STRONG_THR;

      let fillColor: string;
      if (isDiag) {
        fillColor = tokenColor.bg2;
      } else {
        fillColor = cell ? ratioColor(ratio) : tokenColor.bg0;
      }

      const showRowColTint = (isHovRow || isHovCol || isHighlightRow || isHighlightCol) && !isDiag;
      const showActiveBorder = (isHovCell || isHighlightCell) && !isDiag;

      // Stagger animation delay by row
      const cellDelayMs = ai * 20 + bi * 3;

      const ai_ = ai;
      const bi_ = bi;

      cellEls.push(
        <g
          key={`c-${ai_}-${bi_}`}
          style={{ animation: `_ccv-cellIn 200ms ease-out ${cellDelayMs}ms both` }}
        >
          {/* Base cell */}
          <rect
            x={cx}
            y={cy}
            width={cellSize - 1}
            height={cellSize - 1}
            rx={1}
            fill={fillColor}
            stroke={isStrong && !isDiag ? "#ffffff" : tokenColor.border}
            strokeWidth={isStrong && !isDiag ? 2 : 0.5}
            style={{ cursor: !isDiag && onFocusEntity ? "pointer" : "default" }}
            onMouseEnter={() => handleCellEnter(ai_, bi_, cx, cy)}
            onMouseLeave={handleCellLeave}
            onClick={() => handleCellClick(ai_, bi_)}
          />

          {/* Diagonal line pattern for diagonal cells */}
          {isDiag && (
            <line
              x1={cx}
              y1={cy + cellSize - 1}
              x2={cx + cellSize - 1}
              y2={cy}
              stroke={tokenColor.border}
              strokeWidth={1}
              pointerEvents="none"
            />
          )}

          {/* Row+col hover/highlight tint */}
          {showRowColTint && (
            <rect
              x={cx}
              y={cy}
              width={cellSize - 1}
              height={cellSize - 1}
              rx={1}
              fill={ACCENT}
              fillOpacity={0.08}
              pointerEvents="none"
            />
          )}

          {/* Active cell border */}
          {showActiveBorder && (
            <rect
              x={cx}
              y={cy}
              width={cellSize - 1}
              height={cellSize - 1}
              rx={1}
              fill="none"
              stroke={ACCENT}
              strokeWidth={1.5}
              pointerEvents="none"
            />
          )}
        </g>,
      );
    }
  }

  // ── Y-axis labels ─────────────────────────────────────────────────
  const yLabels = layout.fileNames.map((name, ai) => {
    const cy = gridTop + ai * cellSize + cellSize / 2;
    const isActive = hovered?.ai === ai || highlightPair?.ai === ai || highlightPair?.bi === ai;
    return (
      <text
        key={`yl-${ai}`}
        x={LABEL_X_W - 6}
        y={cy + 1}
        textAnchor="end"
        dominantBaseline="middle"
        fill={isActive ? tokenColor.text0 : tokenColor.text2}
        fontSize={Math.max(font.size.xxs, Math.min(font.size.xs, cellSize - 3))}
        fontFamily={font.mono}
        fontWeight={isActive ? font.weight.semibold : font.weight.regular}
      >
        {truncate(name, 15)}
      </text>
    );
  });

  // ── X-axis labels (rotated) ───────────────────────────────────────
  const xLabels = layout.fileNames.map((name, bi) => {
    const cx = gridLeft + bi * cellSize + cellSize / 2;
    const isActive = hovered?.bi === bi || highlightPair?.ai === bi || highlightPair?.bi === bi;
    return (
      <text
        key={`xl-${bi}`}
        x={cx}
        y={LABEL_Y_H - 6}
        textAnchor="start"
        dominantBaseline="auto"
        fill={isActive ? tokenColor.text0 : tokenColor.text2}
        fontSize={Math.max(font.size.xxs, Math.min(font.size.xs, cellSize - 3))}
        fontFamily={font.mono}
        fontWeight={isActive ? font.weight.semibold : font.weight.regular}
        transform={`rotate(-45,${cx},${LABEL_Y_H - 6})`}
      >
        {truncate(name, 15)}
      </text>
    );
  });

  // ── Color scale legend (bottom-right, horizontal) ─────────────────
  const legendW = 80;
  const legendH = 8;
  const legendX = Math.min(gridLeft + N * cellSize + 16, width - legendW - 60);
  const legendY = height - PAD_B - legendH - 14;
  const legendGradId = "ccv-grad";

  const legendStops = Array.from({ length: 5 }, (_, i) => ({
    offset: `${i * 25}%`,
    color: ratioColor(i / 4),
  }));

  const legend = (
    <g key="legend">
      <defs>
        <linearGradient id={legendGradId} x1="0" y1="0" x2="1" y2="0">
          {legendStops.map(s => (
            <stop key={s.offset} offset={s.offset} stopColor={s.color} />
          ))}
        </linearGradient>
      </defs>
      <rect
        x={legendX}
        y={legendY}
        width={legendW}
        height={legendH}
        rx={legendH / 2}
        fill={`url(#${legendGradId})`}
        stroke={tokenColor.border}
        strokeWidth={0.5}
      />
      <text
        x={legendX}
        y={legendY + legendH + 10}
        fill={tokenColor.text3}
        fontSize={font.size.xxs}
        fontFamily={font.sans}
        textAnchor="start"
      >
        0%
      </text>
      <text
        x={legendX + legendW}
        y={legendY + legendH + 10}
        fill={tokenColor.text3}
        fontSize={font.size.xxs}
        fontFamily={font.sans}
        textAnchor="end"
      >
        100%
      </text>
    </g>
  );

  // ── Tooltip ───────────────────────────────────────────────────────
  const tipW = 210;
  const lineH = 15;
  const tipEl = tooltip && (
    <g key="tip" transform={`translate(${tooltip.x},${tooltip.y})`}>
      <rect
        x={0}
        y={0}
        width={tipW}
        height={10 + tooltip.lines.length * lineH}
        rx={4}
        fill={tokenColor.bg0}
        stroke={tokenColor.border}
        strokeWidth={1}
        filter="drop-shadow(0 2px 8px rgba(0,0,0,0.08))"
      />
      {tooltip.lines.map((line, i) => (
        <text
          key={i}
          x={9}
          y={12 + i * lineH}
          fill={i === 0 ? tokenColor.text0 : tokenColor.text2}
          fontSize={i === 0 ? font.size.xs : font.size.xxs}
          fontFamily={font.sans}
          fontWeight={i === 0 ? font.weight.semibold : font.weight.regular}
        >
          {line}
        </text>
      ))}
    </g>
  );

  return (
    <>
      {cellEls}
      {yLabels}
      {xLabels}
      {legend}
      {tipEl}
    </>
  );
}

// ── Summary strip ─────────────────────────────────────────────────────

function SummaryStrip({ layout }: { layout: CoChangeLayout }) {
  const N = layout.fileOrder.length;
  const M = layout.totalSnapshots;

  // Find strongest coupling
  const strongest = useMemo(
    () => [...layout.cells].sort((a, b) => b.ratio - a.ratio)[0],
    [layout.cells],
  );

  const stripStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: space[4],
    padding: `${space[1]}px ${space[4]}px`,
    borderBottom: `1px solid ${tokenColor.border}`,
    backgroundColor: tokenColor.bg2,
    flexShrink: 0,
    flexWrap: "wrap",
  };

  const itemStyle: CSSProperties = {
    fontSize: font.size.xs,
    fontFamily: font.sans,
    color: tokenColor.text2,
    display: "flex",
    alignItems: "center",
    gap: 4,
  };

  const highlightStyle: CSSProperties = {
    color: tokenColor.text0,
    fontWeight: font.weight.semibold,
    fontFamily: font.mono,
  };

  return (
    <div style={stripStyle}>
      <span style={itemStyle}>
        Tracking{" "}
        <span style={highlightStyle}>{N}</span>{" "}
        files across{" "}
        <span style={highlightStyle}>{M}</span>{" "}
        snapshots
      </span>
      {strongest && (
        <span style={itemStyle}>
          Strongest:{" "}
          <span style={highlightStyle}>{truncate(strongest.nameA, 12)}</span>
          <span style={{ color: ACCENT, fontWeight: font.weight.semibold }}> ↔ </span>
          <span style={highlightStyle}>{truncate(strongest.nameB, 12)}</span>
          {" "}({fmtPct(strongest.ratio)})
        </span>
      )}
    </div>
  );
}

// ── Empty states ──────────────────────────────────────────────────────

function EmptyState({ message, sub }: { message: string; sub?: string }) {
  const wrapStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    gap: space[2],
    color: tokenColor.text2,
    fontSize: font.size.md,
    fontFamily: font.sans,
    padding: `${space[7]}px ${space[4]}px`,
    textAlign: "center",
  };
  return (
    <div style={wrapStyle}>
      <span style={{ fontSize: 26 }} role="img" aria-hidden="true">📊</span>
      <span style={{ fontWeight: font.weight.medium, color: tokenColor.text1 }}>{message}</span>
      {sub && (
        <span style={{ fontSize: font.size.xs, color: tokenColor.text2, maxWidth: 280, lineHeight: 1.5 }}>
          {sub}
        </span>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────

function CoChangeViewImpl({ graph, onFocusEntity, onDismiss }: CoChangeViewProps) {
  const [mounted, setMounted] = useState(false);
  const [svgSize, setSvgSize] = useState({ width: 400, height: 400 });
  const [selectedPair, setSelectedPair] = useState<{ ai: number; bi: number } | null>(null);
  const containerRef  = useRef<HTMLDivElement>(null);
  const matrixWrapRef = useRef<HTMLDivElement>(null);

  injectKeyframes();

  // Fade-in on mount
  useEffect(() => {
    let r1 = 0;
    let r2 = 0;
    r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => setMounted(true));
    });
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
  }, []);

  // Escape to dismiss
  useEffect(() => {
    if (!onDismiss) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onDismiss(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onDismiss]);

  // Observe matrix pane size
  useEffect(() => {
    const el = matrixWrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const r = entries[0];
      if (r) setSvgSize({ width: r.contentRect.width, height: r.contentRect.height });
    });
    ro.observe(el);
    setSvgSize({ width: el.offsetWidth, height: el.offsetHeight });
    return () => ro.disconnect();
  }, []);

  const layout = useMemo(() => buildCoChangeLayout({ graph }), [graph]);

  const handlePairSelect = useCallback((ai: number, bi: number) => {
    setSelectedPair(prev =>
      prev?.ai === ai && prev?.bi === bi ? null : { ai, bi },
    );
  }, []);

  const showEmpty = !layout.hasHistory || layout.fileOrder.length === 0;

  // ── Styles ────────────────────────────────────────────────────────

  const rootStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    width: "100%",
    height: "100%",
    backgroundColor: tokenColor.bg1,
    borderRadius: radius.md,
    overflow: "hidden",
    opacity: mounted ? 1 : 0,
    transform: mounted ? "none" : "translateY(8px)",
    transition: `opacity ${ENTRY_MS}ms ease-out, transform ${ENTRY_MS}ms ease-out`,
    fontFamily: font.sans,
    animation: `_ccv-fadeUp ${ENTRY_MS}ms ease-out both`,
  };

  const headerStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: `${space[3]}px ${space[4]}px`,
    borderBottom: `1px solid ${tokenColor.border}`,
    gap: space[3],
    flexShrink: 0,
  };

  const titleStyle: CSSProperties = {
    fontSize: font.size.lg,
    fontWeight: font.weight.bold,
    color: tokenColor.text0,
    fontFamily: font.sans,
    lineHeight: 1,
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
    borderRadius: radius.sm,
    border: "none",
    backgroundColor: "transparent",
    color: tokenColor.text2,
    fontSize: font.size.md,
    cursor: "pointer",
    padding: 0,
    flexShrink: 0,
    transition: `color ${transition.fast}`,
  };

  const bodyStyle: CSSProperties = {
    display: "flex",
    flex: 1,
    overflow: "hidden",
    minHeight: 0,
  };

  return (
    <div ref={containerRef} style={rootStyle} role="region" aria-label="Co-change Network">
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={titleStyle}>Co-change Network</span>
          <span style={subtitleStyle}>files that evolve together</span>
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
          ? <EmptyState
              message="No co-change detected"
              sub="No files changed together across the tracked snapshots"
            />
          : <EmptyState
              message="No history data"
              sub="No history data · Connect a repository to see co-change patterns"
            />
      ) : (
        <>
          <SummaryStrip layout={layout} />

          <div style={bodyStyle}>
            {/* Matrix pane (70%) */}
            <div
              ref={matrixWrapRef}
              style={{ flex: "0 0 70%", overflow: "hidden", position: "relative", minWidth: 0 }}
            >
              <svg
                width={svgSize.width}
                height={svgSize.height}
                viewBox={`0 0 ${svgSize.width} ${svgSize.height}`}
                style={{ display: "block", userSelect: "none" }}
                role="img"
                aria-label="Co-change matrix heatmap"
              >
                <title>Co-change matrix heatmap</title>
                <rect
                  x={0}
                  y={0}
                  width={svgSize.width}
                  height={svgSize.height}
                  fill={tokenColor.bg1}
                />
                <MatrixPanel
                  layout={layout}
                  width={svgSize.width}
                  height={svgSize.height}
                  onFocusEntity={onFocusEntity}
                  highlightPair={selectedPair}
                  onCellClick={handlePairSelect}
                />
              </svg>
            </div>

            {/* Top Couplings panel (30%) */}
            <TopCouplingsPanel
              cells={layout.cells}
              fileOrder={layout.fileOrder}
              onSelectPair={handlePairSelect}
              selectedPair={selectedPair}
            />
          </div>
        </>
      )}
    </div>
  );
}

export const CoChangeView = memo(CoChangeViewImpl);
