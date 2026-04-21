// StartHereView — journey map: "where to begin your codebase tour"
//
// Left side: SVG concentric journey map
//   - Up to 12 numbered circles arranged in a reading-order grid (4 cols × 3 rows)
//   - Each circle: rank number center, short file name below
//   - Circle size ∝ score
//   - Ring color from layout (green=safe/hub, red=risky)
//   - Three thin arc segments around each circle: centrality / entryPoint / risk
//   - Dashed gray connection arrows between circle #1 → #2 → #3 (reading order)
//
// Right side: DOM list
//   - Full file IDs + descriptions
//   - Hover a list entry: highlights the corresponding SVG circle
//
// Pure SVG for the visualization, pure DOM for the list panel.

import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { color as tokenColor, font, radius, shadow } from "../../../shared/ui/tokens";
import type { StartHereLayout, StartHereRow } from "../model/types";
import type { WorkspaceGraph } from "@quanta/canvas-engine";
import { buildStartHereLayout } from "../model/build-start-here-layout";

export interface StartHereViewProps {
  graph: WorkspaceGraph;
  onFocusEntity?: (id: string) => void;
  onDismiss?: () => void;
}

const ENTRY_MS = 280;

// ─── Grid geometry ──────────────────────────────────────────────────────────

const COLS = 4;
const ROWS = 3;
const CELL_W = 110;
const CELL_H = 110;
const SVG_PAD = 20;
const SVG_W = COLS * CELL_W + SVG_PAD * 2;
const SVG_H = ROWS * CELL_H + SVG_PAD * 2;

const MIN_R = 22;
const MAX_R = 38;
const ARC_OUTER_PAD = 6; // gap between circle edge and arc ring
const ARC_WIDTH = 4;

function gridCenter(rank: number): { cx: number; cy: number } {
  const idx = rank - 1;
  const col = idx % COLS;
  const row = Math.floor(idx / COLS);
  return {
    cx: SVG_PAD + col * CELL_W + CELL_W / 2,
    cy: SVG_PAD + row * CELL_H + CELL_H / 2,
  };
}

function circleRadius(score: number): number {
  // score is 0..1; map to MIN_R..MAX_R
  return MIN_R + (MAX_R - MIN_R) * Math.max(0, Math.min(1, score));
}

// ─── Arc segment helpers ────────────────────────────────────────────────────

/** Returns SVG arc path data for a segment (startAngle..endAngle in radians) on a circle. */
function arcPath(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  const gap = 0.05; // radians gap between segments
  const s = startAngle + gap / 2;
  const e = endAngle - gap / 2;
  if (e <= s) return "";
  const x1 = cx + r * Math.cos(s);
  const y1 = cy + r * Math.sin(s);
  const x2 = cx + r * Math.cos(e);
  const y2 = cy + r * Math.sin(e);
  const large = e - s > Math.PI ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

// The three segments divide the full circle into equal thirds.
const THIRD = (2 * Math.PI) / 3;

interface ArcRingProps {
  cx: number;
  cy: number;
  innerR: number;
  centrality: number;
  entryPoint: number;
  risk: number;
}

function ArcRing({ cx, cy, innerR, centrality, entryPoint, risk }: ArcRingProps) {
  const r = innerR + ARC_OUTER_PAD + ARC_WIDTH / 2;

  const segments = [
    { value: centrality, color: "#0d99ff", label: "centrality", startAngle: -Math.PI / 2 },
    { value: entryPoint, color: "#22a06b", label: "entry point", startAngle: -Math.PI / 2 + THIRD },
    { value: risk, color: "#ef4444", label: "risk", startAngle: -Math.PI / 2 + THIRD * 2 },
  ];

  return (
    <>
      {segments.map(({ value, color, label, startAngle }) => {
        if (value <= 0.02) return null;
        // Arc length proportional to value: max is a full third
        const sweep = THIRD * Math.min(1, value);
        const d = arcPath(cx, cy, r, startAngle, startAngle + sweep);
        if (!d) return null;
        return (
          <path
            key={label}
            d={d}
            stroke={color}
            strokeWidth={ARC_WIDTH}
            fill="none"
            opacity={0.75}
            strokeLinecap="round"
          >
            <title>{label}: {(value * 100).toFixed(0)}%</title>
          </path>
        );
      })}
    </>
  );
}

// ─── Dashed connection arrows ───────────────────────────────────────────────

interface ConnectionArrowProps {
  from: { cx: number; cy: number; r: number };
  to: { cx: number; cy: number; r: number };
}

function ConnectionArrow({ from, to }: ConnectionArrowProps) {
  const dx = to.cx - from.cx;
  const dy = to.cy - from.cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 1) return null;
  const ux = dx / dist;
  const uy = dy / dist;
  // Start and end at circle edges
  const x1 = from.cx + ux * (from.r + ARC_OUTER_PAD + ARC_WIDTH + 4);
  const y1 = from.cy + uy * (from.r + ARC_OUTER_PAD + ARC_WIDTH + 4);
  const x2 = to.cx - ux * (to.r + ARC_OUTER_PAD + ARC_WIDTH + 4);
  const y2 = to.cy - uy * (to.r + ARC_OUTER_PAD + ARC_WIDTH + 4);

  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={tokenColor.border}
      strokeWidth={1.5}
      strokeDasharray="4 3"
      markerEnd="url(#arrow-head)"
    />
  );
}

// ─── Journey circle node ────────────────────────────────────────────────────

interface CircleNodeProps {
  row: StartHereRow;
  highlighted: boolean;
  onHover: (rank: number | null) => void;
  onClick: (fileId: string) => void;
}

function CircleNode({ row, highlighted, onHover, onClick }: CircleNodeProps) {
  const { cx, cy } = gridCenter(row.rank);
  const r = circleRadius(row.score);

  const handleMouseEnter = useCallback(() => onHover(row.rank), [onHover, row.rank]);
  const handleMouseLeave = useCallback(() => onHover(null), [onHover]);
  const handleClick = useCallback(() => onClick(row.fileId), [onClick, row.fileId]);

  const fillColor = highlighted ? tokenColor.accentSoft : tokenColor.bg0;
  const strokeColor = highlighted ? tokenColor.accent : row.ringColor;
  const strokeWidth = highlighted ? 2.5 : 1.8;

  // Truncate filename if too long for the cell
  const maxChars = Math.floor((CELL_W - 12) / 6);
  const displayName =
    row.fileName.length > maxChars
      ? `${row.fileName.slice(0, maxChars - 1)}…`
      : row.fileName;

  return (
    <g
      style={{ cursor: "pointer" }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      role="button"
      aria-label={`#${row.rank} ${row.fileName} — ${row.description}`}
    >
      {/* Main circle */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
      />

      {/* Rank number */}
      <text
        x={cx}
        y={cy + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={r > 28 ? font.size.xl : font.size.lg}
        fontWeight={font.weight.bold}
        fontFamily={font.sans}
        fill={highlighted ? tokenColor.accent : tokenColor.text0}
        style={{ userSelect: "none", pointerEvents: "none" }}
      >
        {row.rank}
      </text>

      {/* File name below circle */}
      <text
        x={cx}
        y={cy + r + 13}
        textAnchor="middle"
        fontSize={font.size.xs}
        fontFamily={font.sans}
        fill={highlighted ? tokenColor.accent : tokenColor.text2}
        style={{ userSelect: "none", pointerEvents: "none" }}
      >
        {displayName}
      </text>

      {/* Three-segment arc ring */}
      <ArcRing
        cx={cx}
        cy={cy}
        innerR={r}
        centrality={row.centrality}
        entryPoint={row.entryPoint}
        risk={row.risk}
      />
    </g>
  );
}

// ─── Journey SVG map ────────────────────────────────────────────────────────

interface JourneyMapProps {
  rows: StartHereRow[];
  highlightedRank: number | null;
  onHover: (rank: number | null) => void;
  onFocusEntity?: (id: string) => void;
}

function JourneyMap({ rows, highlightedRank, onHover, onFocusEntity }: JourneyMapProps) {
  const handleClick = useCallback(
    (fileId: string) => onFocusEntity?.(fileId),
    [onFocusEntity],
  );

  // Pre-compute radii for connection arrows
  const radiiByRank: Record<number, number> = {};
  for (const row of rows) {
    radiiByRank[row.rank] = circleRadius(row.score);
  }

  // First 3 connections: #1→#2, #2→#3
  const arrows: Array<[StartHereRow, StartHereRow]> = [];
  for (let i = 0; i < Math.min(rows.length - 1, 3); i++) {
    const from = rows[i];
    const to = rows[i + 1];
    if (from && to) arrows.push([from, to]);
  }

  const svgStyle: CSSProperties = {
    display: "block",
    flexShrink: 0,
  };

  return (
    <svg
      width={SVG_W}
      height={SVG_H}
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      style={svgStyle}
      aria-label="Journey map — codebase tour order"
      role="img"
    >
      <defs>
        <marker
          id="arrow-head"
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
          orient="auto"
        >
          <path d="M 0 0 L 6 3 L 0 6 z" fill={tokenColor.border} />
        </marker>
      </defs>

      {/* Connection arrows (below circles) */}
      {arrows.map(([from, to]) => {
        const fc = gridCenter(from.rank);
        const tc = gridCenter(to.rank);
        return (
          <ConnectionArrow
            key={`${from.rank}-${to.rank}`}
            from={{ cx: fc.cx, cy: fc.cy, r: radiiByRank[from.rank] ?? MIN_R }}
            to={{ cx: tc.cx, cy: tc.cy, r: radiiByRank[to.rank] ?? MIN_R }}
          />
        );
      })}

      {/* Circle nodes */}
      {rows.map((row) => (
        <CircleNode
          key={row.fileId}
          row={row}
          highlighted={highlightedRank === row.rank}
          onHover={onHover}
          onClick={handleClick}
        />
      ))}
    </svg>
  );
}

// ─── Right panel list ────────────────────────────────────────────────────────

interface ListPanelProps {
  rows: StartHereRow[];
  highlightedRank: number | null;
  onHover: (rank: number | null) => void;
  onFocusEntity?: (id: string) => void;
}

function ListPanel({ rows, highlightedRank, onHover, onFocusEntity }: ListPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedRank === null) return;
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-rank="${highlightedRank}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [highlightedRank]);

  const panelStyle: CSSProperties = {
    flex: 1,
    overflowY: "auto",
    borderLeft: `1px solid ${tokenColor.border}`,
    minWidth: 0,
  };

  return (
    <div style={panelStyle} ref={scrollRef}>
      {rows.map((row) => {
        const isHighlighted = highlightedRank === row.rank;
        const entryStyle: CSSProperties = {
          padding: "7px 14px",
          cursor: "pointer",
          background: isHighlighted ? tokenColor.accentSofter : "transparent",
          borderBottom: `1px solid ${tokenColor.borderSoft}`,
          transition: "background 120ms ease",
          borderLeft: isHighlighted
            ? `3px solid ${tokenColor.accent}`
            : "3px solid transparent",
        };
        const rankNumStyle: CSSProperties = {
          width: 20,
          flexShrink: 0,
          fontFamily: font.mono,
          fontSize: font.size.xxs,
          color: isHighlighted ? tokenColor.accent : tokenColor.text3,
          fontWeight: font.weight.bold,
        };
        const topStyle: CSSProperties = {
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 2,
        };
        const fileIdStyle: CSSProperties = {
          flex: 1,
          fontSize: font.size.xs,
          fontFamily: font.mono,
          color: isHighlighted ? tokenColor.text0 : tokenColor.text1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          fontWeight: isHighlighted ? font.weight.semibold : font.weight.regular,
        };
        const descStyle: CSSProperties = {
          fontSize: font.size.xxs,
          color: isHighlighted ? tokenColor.accent : tokenColor.text3,
          paddingLeft: 26,
        };
        const dotStyle: CSSProperties = {
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: row.ringColor,
          flexShrink: 0,
        };

        return (
          <div
            key={row.fileId}
            data-rank={row.rank}
            style={entryStyle}
            onMouseEnter={() => onHover(row.rank)}
            onMouseLeave={() => onHover(null)}
            onClick={() => onFocusEntity?.(row.fileId)}
            role="button"
            tabIndex={0}
            aria-label={`#${row.rank} ${row.fileId} — ${row.description}`}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onFocusEntity?.(row.fileId);
              }
            }}
          >
            <div style={topStyle}>
              <span style={rankNumStyle}>#{row.rank}</span>
              <span style={dotStyle} />
              <span style={fileIdStyle} title={row.fileId}>{row.fileId}</span>
            </div>
            <div style={descStyle}>{row.description}</div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Arc legend ─────────────────────────────────────────────────────────────

function ArcLegend() {
  const style: CSSProperties = {
    display: "flex",
    gap: 14,
    padding: "5px 16px 5px 20px",
    borderTop: `1px solid ${tokenColor.border}`,
    flexShrink: 0,
    background: tokenColor.bg1,
  };
  const entryStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 4,
    fontSize: font.size.xxs,
    color: tokenColor.text2,
  };
  const swatchStyle = (clr: string): CSSProperties => ({
    width: 16,
    height: 3,
    borderRadius: 2,
    background: clr,
    flexShrink: 0,
  });

  return (
    <div style={style}>
      <div style={entryStyle}><span style={swatchStyle("#0d99ff")} />centrality</div>
      <div style={entryStyle}><span style={swatchStyle("#22a06b")} />entry point</div>
      <div style={entryStyle}><span style={swatchStyle("#ef4444")} />risk</div>
    </div>
  );
}

// ─── Main view ───────────────────────────────────────────────────────────────

function StartHereViewImpl({ graph, onFocusEntity, onDismiss }: StartHereViewProps) {
  const [mounted, setMounted] = useState(false);
  const [highlightedRank, setHighlightedRank] = useState<number | null>(null);
  const layoutRef = useRef<StartHereLayout | null>(null);

  // Compute layout once on mount / graph change
  if (layoutRef.current === null) {
    layoutRef.current = buildStartHereLayout({ graph });
  }
  const layout = layoutRef.current;

  useEffect(() => {
    layoutRef.current = buildStartHereLayout({ graph });
  }, [graph]);

  // Two-rAF fade-in
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

  const rootStyle: CSSProperties = {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    background: tokenColor.bg1,
    overflow: "hidden",
    opacity: mounted ? 1 : 0,
    transition: `opacity ${ENTRY_MS}ms ease-out`,
    fontFamily: font.sans,
    position: "relative",
  };

  const headerStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    padding: "10px 16px",
    borderBottom: `1px solid ${tokenColor.border}`,
    background: tokenColor.bg1,
    flexShrink: 0,
    gap: 8,
  };

  const titleStyle: CSSProperties = {
    fontSize: font.size.lg,
    fontWeight: font.weight.bold,
    color: tokenColor.text0,
    lineHeight: 1,
  };

  const subtitleStyle: CSSProperties = {
    fontSize: font.size.xs,
    color: tokenColor.text2,
    flex: 1,
    lineHeight: 1,
  };

  const dismissStyle: CSSProperties = {
    width: 20,
    height: 20,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    color: tokenColor.text2,
    fontSize: font.size.md,
    borderRadius: radius.xs,
    flexShrink: 0,
    background: "transparent",
    border: "none",
    padding: 0,
    lineHeight: 1,
  };

  const bodyStyle: CSSProperties = {
    flex: 1,
    display: "flex",
    flexDirection: "row",
    overflow: "hidden",
    minHeight: 0,
  };

  const mapPaneStyle: CSSProperties = {
    flexShrink: 0,
    overflowY: "auto",
    padding: "12px 8px",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
  };

  const emptyStyle: CSSProperties = {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: font.size.md,
    color: tokenColor.text2,
  };

  const subtitle = `${layout.totalFiles} file${layout.totalFiles !== 1 ? "s" : ""} · showing top ${layout.rows.length}`;

  return (
    <div style={rootStyle} role="region" aria-label="Start Here — codebase tour">
      {/* Header */}
      <div style={headerStyle}>
        <span style={titleStyle}>Start Here</span>
        <span style={subtitleStyle}>{subtitle}</span>
        {onDismiss !== undefined && (
          <button
            style={dismissStyle}
            onClick={onDismiss}
            aria-label="Dismiss"
            title="Dismiss"
          >
            ×
          </button>
        )}
      </div>

      {layout.rows.length === 0 ? (
        <div style={emptyStyle}>
          {layout.totalFiles === 0 ? "Load a workspace to begin." : "No files to rank."}
        </div>
      ) : (
        <>
          <div style={bodyStyle}>
            {/* Left: SVG journey map */}
            <div style={mapPaneStyle}>
              <JourneyMap
                rows={layout.rows}
                highlightedRank={highlightedRank}
                onHover={setHighlightedRank}
                onFocusEntity={onFocusEntity}
              />
            </div>

            {/* Right: list panel */}
            <ListPanel
              rows={layout.rows}
              highlightedRank={highlightedRank}
              onHover={setHighlightedRank}
              onFocusEntity={onFocusEntity}
            />
          </div>

          {/* Arc legend footer */}
          <ArcLegend />
        </>
      )}

      {/* Bottom hint */}
      {layout.rows.length > 0 && (
        <div
          style={{
            padding: "4px 16px",
            borderTop: `1px solid ${tokenColor.border}`,
            fontSize: font.size.xxs,
            color: tokenColor.text3,
            flexShrink: 0,
            boxShadow: shadow.xs,
            background: tokenColor.bg1,
          }}
        >
          Hover a circle to highlight · Click to focus on canvas
        </div>
      )}
    </div>
  );
}

export const StartHereView = memo(StartHereViewImpl);
