// StartHereView — journey map: "where to begin your codebase tour" (LEGENDARY redesign)
//
// Layout:
//   • Header: "Start Here" + subtitle + "Begin Tour →" button + dismiss ×
//   • Body (left 55% / right 45%):
//     - Left: SVG journey map with numbered circles, arc rings, dashed arrows,
//       animated flow dot, score labels inside top-3 circles, constellation bg
//     - Right: scrollable list with rank badge, full path, score bar, description
//   • Breakdown tooltip on circle hover (centrality / entryPoint / risk bars)
//   • Circles appear with stagger (rank * 60ms), fade-up container entry
//   • Score count-up animation from 0 to final value
//   • Animated connection arcs with stroke-dashoffset draw-on
//   • Constellation background (stars + edges + twinkle)
//   • "Begin Tour →" button hover triggers rank-1 circle pulse
//   • Arc legend footer
//
// Pure SVG + DOM — inline styles only — no className — strict TypeScript.

import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  color as tokenColor,
  font,
  radius,
  space,
  shadow,
  transition,
} from "../../../shared/ui/tokens";
import type { StartHereLayout, StartHereRow } from "../model/types";
import type { WorkspaceGraph } from "@quanta/canvas-engine";
import { buildStartHereLayout } from "../model/build-start-here-layout";

export interface StartHereViewProps {
  graph: WorkspaceGraph;
  onFocusEntity?: (id: string) => void;
  onDismiss?: () => void;
}

const ENTRY_MS = 250;

// ─── Keyframe injection (once) ──────────────────────────────────────────────

let _shStylesInjected = false;
function injectStyles(): void {
  if (_shStylesInjected || typeof document === "undefined") return;
  _shStylesInjected = true;
  const style = document.createElement("style");
  style.textContent = `
    @keyframes sh-fadeUp {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes sh-circleIn {
      from { opacity: 0; transform-origin: center; transform: scale(0.6); }
      to   { opacity: 1; transform: scale(1); }
    }
    @keyframes sh-flow {
      0%   { offset-distance: 0%; }
      100% { offset-distance: 100%; }
    }
    @keyframes sh-twinkle {
      0%, 100% { opacity: 0.4; }
      50%       { opacity: 0.8; }
    }
    @keyframes sh-heroPulse {
      0%   { transform: scale(1); }
      50%  { transform: scale(1.1); }
      100% { transform: scale(1); }
    }
  `;
  document.head.appendChild(style);
}

// ─── SVG geometry constants ──────────────────────────────────────────────────

const COLS = 4;
const ROWS = 3;
const CELL_W = 108;
const CELL_H = 108;
const SVG_PAD = 22;
const SVG_W = COLS * CELL_W + SVG_PAD * 2;
const SVG_H = ROWS * CELL_H + SVG_PAD * 2;

/** Score=1 → 40px, score=0 → 14px (rank 1 through 12) */
const MIN_R = 14;
const MAX_R = 40;

/** Gap between circle edge and arc ring center */
const ARC_OUTER_PAD = 5;
const ARC_STROKE = 3;

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
  return MIN_R + (MAX_R - MIN_R) * Math.max(0, Math.min(1, score));
}

/** Fill color: score 1 → hsl(145,60%,45%) green, score 0 → hsl(20,80%,55%) orange */
function circleFillColor(score: number): string {
  const h = 145 - (145 - 20) * (1 - Math.max(0, Math.min(1, score)));
  const s = 60 + (80 - 60) * (1 - score);
  const l = 45 + (55 - 45) * (1 - score);
  return `hsl(${h.toFixed(0)}deg, ${s.toFixed(0)}%, ${l.toFixed(0)}%)`;
}

// ─── Pseudo-random seeded number generator ──────────────────────────────────

function seededRand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

// ─── Arc segment helpers ────────────────────────────────────────────────────

const GAP_RAD = 0.08;
const THIRD = (2 * Math.PI) / 3;

function arcPath(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  const s = startAngle + GAP_RAD / 2;
  const e = endAngle - GAP_RAD / 2;
  if (e <= s) return "";
  const x1 = cx + r * Math.cos(s);
  const y1 = cy + r * Math.sin(s);
  const x2 = cx + r * Math.cos(e);
  const y2 = cy + r * Math.sin(e);
  const large = e - s > Math.PI ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

interface ArcRingProps {
  cx: number;
  cy: number;
  innerR: number;
  centrality: number;
  entryPoint: number;
  risk: number;
  highlighted: boolean;
}

function ArcRing({
  cx,
  cy,
  innerR,
  centrality,
  entryPoint,
  risk,
  highlighted,
}: ArcRingProps) {
  const r = innerR + ARC_OUTER_PAD + ARC_STROKE / 2;
  const segments: Array<{
    value: number;
    color: string;
    label: string;
    startAngle: number;
  }> = [
    {
      value: centrality,
      color: "#0d99ff",
      label: "centrality",
      startAngle: -Math.PI / 2,
    },
    {
      value: entryPoint,
      color: "#22c55e",
      label: "entry point",
      startAngle: -Math.PI / 2 + THIRD,
    },
    {
      value: risk,
      color: "#ef4444",
      label: "risk",
      startAngle: -Math.PI / 2 + THIRD * 2,
    },
  ];

  return (
    <>
      {segments.map(({ value, color, label, startAngle }) => {
        if (value <= 0.02) return null;
        const sweep = THIRD * Math.min(1, value);
        const d = arcPath(cx, cy, r, startAngle, startAngle + sweep);
        if (!d) return null;
        return (
          <path
            key={label}
            d={d}
            stroke={color}
            strokeWidth={highlighted ? ARC_STROKE + 1 : ARC_STROKE}
            fill="none"
            opacity={highlighted ? 0.95 : 0.7}
            strokeLinecap="round"
          >
            <title>
              {label}: {(value * 100).toFixed(0)}%
            </title>
          </path>
        );
      })}
    </>
  );
}

// ─── Constellation background ─────────────────────────────────────────────────

interface ConstellationBgProps {
  seed: number;
  twinklingIndices: Set<number>;
}

interface StarPoint {
  x: number;
  y: number;
}

function ConstellationBg({ seed, twinklingIndices }: ConstellationBgProps) {
  const rand = seededRand(seed + 42);

  const stars: StarPoint[] = Array.from({ length: 30 }, () => ({
    x: rand() * SVG_W,
    y: rand() * SVG_H,
  }));

  const maxDist = SVG_W * 0.22;
  const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  for (let i = 0; i < stars.length; i++) {
    for (let j = i + 1; j < stars.length; j++) {
      const si = stars[i]!;
      const sj = stars[j]!;
      const dx = si.x - sj.x;
      const dy = si.y - sj.y;
      if (Math.sqrt(dx * dx + dy * dy) < maxDist) {
        lines.push({ x1: si.x, y1: si.y, x2: sj.x, y2: sj.y });
      }
    }
  }

  return (
    <g pointerEvents="none">
      {/* Constellation lines */}
      {lines.map((l, i) => (
        <line
          key={i}
          x1={l.x1}
          y1={l.y1}
          x2={l.x2}
          y2={l.y2}
          stroke={tokenColor.border}
          strokeWidth={0.3}
          opacity={0.25}
        />
      ))}
      {/* Stars */}
      {stars.map((s, i) => (
        <circle
          key={i}
          cx={s.x}
          cy={s.y}
          r={0.8}
          fill={tokenColor.text3}
          opacity={0.4}
          style={
            twinklingIndices.has(i)
              ? {
                  animation: "sh-twinkle 3s ease-in-out both",
                  animationDuration: "3s",
                }
              : undefined
          }
        />
      ))}
    </g>
  );
}

// ─── Dashed connection arrow ────────────────────────────────────────────────

interface ConnectionArrowProps {
  from: { cx: number; cy: number; r: number };
  to: { cx: number; cy: number; r: number };
  arcId: string;
  arcRef: (el: SVGPathElement | null) => void;
  drawLength: number | null;
}

function ConnectionArrow({ from, to, arcId, arcRef, drawLength }: ConnectionArrowProps) {
  const dx = to.cx - from.cx;
  const dy = to.cy - from.cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 1) return null;
  const ux = dx / dist;
  const uy = dy / dist;
  const pad = ARC_OUTER_PAD + ARC_STROKE + 5;
  const x1 = from.cx + ux * (from.r + pad);
  const y1 = from.cy + uy * (from.r + pad);
  const x2 = to.cx - ux * (to.r + pad);
  const y2 = to.cy - uy * (to.r + pad);

  // When drawLength is null (unmeasured), hide. When > 0 animate draw.
  const strokeDasharray = drawLength !== null ? `${drawLength}` : undefined;
  const strokeDashoffset = drawLength !== null ? 0 : drawLength ?? undefined;

  return (
    <line
      id={arcId}
      ref={arcRef}
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={tokenColor.border}
      strokeWidth={1.5}
      strokeDasharray={strokeDasharray ?? "4 4"}
      strokeDashoffset={strokeDashoffset}
      markerEnd="url(#sh-arrow)"
    />
  );
}

// ─── Breakdown tooltip ──────────────────────────────────────────────────────

interface BreakdownTooltipProps {
  row: StartHereRow;
  cx: number;
  cy: number;
  r: number;
}

function BreakdownTooltip({ row, cx, cy, r }: BreakdownTooltipProps) {
  const W = 130;
  const H = 72;
  // Position above/below depending on available space
  const yPos = cy - r - ARC_OUTER_PAD - ARC_STROKE - H - 8;
  const xPos = cx - W / 2;

  const barEntries: Array<{ label: string; value: number; color: string }> = [
    { label: "Centrality", value: row.centrality, color: "#0d99ff" },
    { label: "Entry Point", value: row.entryPoint, color: "#22c55e" },
    { label: "Risk", value: row.risk, color: "#ef4444" },
  ];

  return (
    <g pointerEvents="none">
      {/* Backdrop */}
      <rect
        x={xPos}
        y={yPos}
        width={W}
        height={H}
        rx={radius.sm}
        fill={tokenColor.bg0}
        stroke={tokenColor.border}
        strokeWidth={1}
        filter="drop-shadow(0 2px 6px rgba(0,0,0,0.10))"
      />
      {/* Bars */}
      {barEntries.map(({ label, value, color }, i) => {
        const bx = xPos + 8;
        const by = yPos + 10 + i * 20;
        const bw = W - 16;
        return (
          <g key={label}>
            <text
              x={bx}
              y={by + 9}
              fontSize={font.size.xxs}
              fontFamily={font.sans}
              fill={tokenColor.text2}
              dominantBaseline="middle"
            >
              {label}
            </text>
            <rect x={bx + 60} y={by + 4} width={bw - 62} height={5} rx={2} fill={tokenColor.bg3} />
            <rect
              x={bx + 60}
              y={by + 4}
              width={Math.max(2, (bw - 62) * value)}
              height={5}
              rx={2}
              fill={color}
              opacity={0.85}
            />
          </g>
        );
      })}
    </g>
  );
}

// ─── Circle node ─────────────────────────────────────────────────────────────

interface CircleNodeProps {
  row: StartHereRow;
  highlighted: boolean;
  showTooltip: boolean;
  mounted: boolean;
  heroHighlighted: boolean;
  countedScore: number | undefined;
  onHover: (rank: number | null) => void;
  onClick: (fileId: string) => void;
}

function CircleNode({
  row,
  highlighted,
  showTooltip,
  mounted,
  heroHighlighted,
  countedScore,
  onHover,
  onClick,
}: CircleNodeProps) {
  const { cx, cy } = gridCenter(row.rank);
  const r = circleRadius(row.score);
  const fillColor = circleFillColor(row.score);
  const glowColor = highlighted ? fillColor : "none";

  // Truncate short name to 8 chars
  const shortName =
    row.fileName.length > 8 ? `${row.fileName.slice(0, 7)}…` : row.fileName;

  // Top-3 show score % inside
  const showPct = row.rank <= 3;
  const pctLabel = `${countedScore !== undefined ? countedScore : Math.round(row.score * 100)}%`;

  const staggerMs = (row.rank - 1) * 60;

  const handleMouseEnter = useCallback(
    () => onHover(row.rank),
    [onHover, row.rank],
  );
  const handleMouseLeave = useCallback(() => onHover(null), [onHover]);
  const handleClick = useCallback(
    () => onClick(row.fileId),
    [onClick, row.fileId],
  );

  const isHero = row.rank === 1 && heroHighlighted;

  return (
    <g
      style={{
        cursor: "pointer",
        opacity: mounted ? 1 : 0,
        animation: mounted
          ? `sh-circleIn 280ms ease both ${staggerMs}ms`
          : undefined,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      role="button"
      aria-label={`#${row.rank} ${row.fileName} — ${row.description}`}
    >
      {/* Glow ring when highlighted */}
      {highlighted && (
        <circle
          cx={cx}
          cy={cy}
          r={r + ARC_OUTER_PAD + ARC_STROKE + 6}
          fill="none"
          stroke={glowColor}
          strokeWidth={8}
          opacity={0.18}
        />
      )}

      {/* Hero pulse wrapper */}
      <g
        style={
          isHero
            ? {
                transformOrigin: `${cx}px ${cy}px`,
                animation: "sh-heroPulse 500ms ease-in-out both",
              }
            : undefined
        }
      >
        {/* Main circle */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill={highlighted ? fillColor : `${fillColor}cc`}
          stroke={highlighted ? fillColor : `${fillColor}88`}
          strokeWidth={highlighted ? 2.5 : 1.5}
        />

        {/* Rank number */}
        <text
          x={cx}
          y={showPct ? cy - 4 : cy + 1}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={r >= 30 ? font.size.xl : r >= 22 ? font.size.lg : font.size.md}
          fontWeight={font.weight.semibold}
          fontFamily={font.sans}
          fill="#ffffff"
          style={{ userSelect: "none", pointerEvents: "none" }}
        >
          {row.rank}
        </text>

        {/* Score % inside top-3 circles (count-up animated) */}
        {showPct && (
          <text
            x={cx}
            y={cy + 9}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={font.size.xxs}
            fontWeight={font.weight.medium}
            fontFamily={font.sans}
            fill="rgba(255,255,255,0.80)"
            style={{ userSelect: "none", pointerEvents: "none" }}
          >
            {pctLabel}
          </text>
        )}
      </g>

      {/* File short name below circle */}
      <text
        x={cx}
        y={cy + r + 12}
        textAnchor="middle"
        fontSize={font.size.xxs}
        fontFamily={font.sans}
        fill={highlighted ? tokenColor.text0 : tokenColor.text2}
        fontWeight={highlighted ? font.weight.medium : font.weight.regular}
        style={{ userSelect: "none", pointerEvents: "none" }}
      >
        {shortName}
      </text>

      {/* Three-segment arc ring */}
      <ArcRing
        cx={cx}
        cy={cy}
        innerR={r}
        centrality={row.centrality}
        entryPoint={row.entryPoint}
        risk={row.risk}
        highlighted={highlighted}
      />

      {/* Breakdown tooltip on hover */}
      {showTooltip && (
        <BreakdownTooltip row={row} cx={cx} cy={cy} r={r} />
      )}
    </g>
  );
}

// ─── Animated flow dot ───────────────────────────────────────────────────────

interface FlowDotProps {
  rows: StartHereRow[];
}

function FlowDot({ rows }: FlowDotProps) {
  if (rows.length < 2) return null;

  // Build path from rank1 → rank2 → rank3
  const pts = rows.slice(0, 3).map((row) => {
    const { cx, cy } = gridCenter(row.rank);
    return `${cx.toFixed(1)},${cy.toFixed(1)}`;
  });
  if (pts.length < 2) return null;

  const d = `M ${pts.join(" L ")}`;
  const dotId = "sh-flow-path";

  return (
    <>
      <path id={dotId} d={d} fill="none" stroke="none" />
      <circle r={4} fill="#22c55e" opacity={0.75}>
        <animateMotion
          dur="2.8s"
          repeatCount="indefinite"
          rotate="auto"
        >
          <mpath href={`#${dotId}`} />
        </animateMotion>
      </circle>
    </>
  );
}

// ─── Journey SVG map ─────────────────────────────────────────────────────────

interface JourneyMapProps {
  rows: StartHereRow[];
  highlightedRank: number | null;
  mounted: boolean;
  heroHighlighted: boolean;
  countedScores: Map<string, number>;
  onHover: (rank: number | null) => void;
  onFocusEntity?: (id: string) => void;
  constellationSeed: number;
}

function JourneyMap({
  rows,
  highlightedRank,
  mounted,
  heroHighlighted,
  countedScores,
  onHover,
  onFocusEntity,
  constellationSeed,
}: JourneyMapProps) {
  const handleClick = useCallback(
    (fileId: string) => onFocusEntity?.(fileId),
    [onFocusEntity],
  );

  // Arrows: #1→#2, #2→#3
  const arrows: Array<[StartHereRow, StartHereRow]> = [];
  for (let i = 0; i < Math.min(rows.length - 1, 2); i++) {
    const from = rows[i];
    const to = rows[i + 1];
    if (from && to) arrows.push([from, to]);
  }

  // Arc refs for measuring getTotalLength
  const arcRefsMap = useRef<Map<string, SVGPathElement>>(new Map());
  const [arcLengths, setArcLengths] = useState<Map<string, number>>(new Map());

  // Measure arc lengths after render
  useEffect(() => {
    const newLengths = new Map<string, number>();
    arcRefsMap.current.forEach((el, key) => {
      if (el) {
        try {
          newLengths.set(key, (el as unknown as SVGGeometryElement).getTotalLength?.() ?? 0);
        } catch {
          newLengths.set(key, 0);
        }
      }
    });
    if (newLengths.size > 0) {
      setArcLengths(newLengths);
    }
  }, [arrows.length, rows.length]);

  // Twinkle effect: toggle 2-3 stars every 3s
  const [twinklingIndices, setTwinklingIndices] = useState<Set<number>>(new Set());
  useEffect(() => {
    const rand = seededRand(constellationSeed + 99);
    let counter = 0;
    const tick = () => {
      const count = 2 + (counter % 2); // alternate 2 and 3
      const indices = new Set<number>();
      for (let i = 0; i < count; i++) {
        indices.add(Math.floor(rand() * 30));
      }
      setTwinklingIndices(indices);
      counter++;
    };
    tick();
    const id = setInterval(tick, 3000);
    return () => clearInterval(id);
  }, [constellationSeed]);

  return (
    <svg
      width={SVG_W}
      height={SVG_H}
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      style={{ display: "block", flexShrink: 0 }}
      aria-label="Journey map — codebase tour order"
      role="img"
    >
      <defs>
        <marker
          id="sh-arrow"
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
          orient="auto"
        >
          <path d="M 0 0 L 6 3 L 0 6 z" fill={tokenColor.border} />
        </marker>
      </defs>

      {/* Constellation background (rendered first, behind everything) */}
      <ConstellationBg seed={constellationSeed} twinklingIndices={twinklingIndices} />

      {/* Dashed connection arrows with draw-on animation */}
      {arrows.map(([from, to], i) => {
        const fc = gridCenter(from.rank);
        const tc = gridCenter(to.rank);
        const arcId = `sh-arc-${i}`;
        const len = arcLengths.get(arcId) ?? null;

        return (
          <ConnectionArrow
            key={`${from.rank}-${to.rank}`}
            from={{ cx: fc.cx, cy: fc.cy, r: circleRadius(from.score) }}
            to={{ cx: tc.cx, cy: tc.cy, r: circleRadius(to.score) }}
            arcId={arcId}
            arcRef={(el) => {
              if (el) arcRefsMap.current.set(arcId, el);
              else arcRefsMap.current.delete(arcId);
            }}
            drawLength={len}
          />
        );
      })}

      {/* Animated flow dot */}
      <FlowDot rows={rows} />

      {/* Circle nodes */}
      {rows.map((row) => (
        <CircleNode
          key={row.fileId}
          row={row}
          highlighted={highlightedRank === row.rank}
          showTooltip={highlightedRank === row.rank}
          mounted={mounted}
          heroHighlighted={heroHighlighted}
          countedScore={countedScores.get(row.fileId)}
          onHover={onHover}
          onClick={handleClick}
        />
      ))}
    </svg>
  );
}

// ─── Score bar (mini, for list panel) ────────────────────────────────────────

function ScoreBarMini({ score }: { score: number }) {
  const hue = 145 - (145 - 20) * (1 - score);
  const fill = `hsl(${hue.toFixed(0)}deg, 65%, 48%)`;
  const trackStyle: CSSProperties = {
    flex: 1,
    height: 4,
    borderRadius: radius.pill,
    background: tokenColor.bg3,
    overflow: "hidden",
    minWidth: 40,
  };
  return (
    <div style={trackStyle}>
      <div
        style={{
          height: "100%",
          width: `${(score * 100).toFixed(1)}%`,
          borderRadius: radius.pill,
          background: fill,
          transition: "width 350ms ease",
        }}
      />
    </div>
  );
}

// ─── Right panel list ─────────────────────────────────────────────────────────

interface ListPanelProps {
  rows: StartHereRow[];
  highlightedRank: number | null;
  onHover: (rank: number | null) => void;
  onFocusEntity?: (id: string) => void;
}

function ListPanel({
  rows,
  highlightedRank,
  onHover,
  onFocusEntity,
}: ListPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (highlightedRank === null) return;
    const el = scrollRef.current?.querySelector<HTMLElement>(
      `[data-rank="${highlightedRank}"]`,
    );
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
        const clr = circleFillColor(row.score);

        const entryStyle: CSSProperties = {
          padding: `${space[2]}px ${space[3]}px`,
          cursor: "pointer",
          background: isHighlighted ? `${clr}10` : "transparent",
          borderBottom: `1px solid ${tokenColor.borderSoft}`,
          transition: `background ${transition.fast}`,
          borderLeft: isHighlighted ? `3px solid ${clr}` : "3px solid transparent",
          outline: isHighlighted ? `1px solid ${clr}33` : "none",
        };

        const topStyle: CSSProperties = {
          display: "flex",
          alignItems: "center",
          gap: space[2],
          marginBottom: 3,
        };

        const rankBadgeStyle: CSSProperties = {
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: clr,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          fontSize: font.size.xxs,
          fontWeight: font.weight.semibold,
          color: "#ffffff",
          lineHeight: 1,
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

        const bottomStyle: CSSProperties = {
          display: "flex",
          alignItems: "center",
          gap: space[2],
          paddingLeft: 24,
        };

        const descStyle: CSSProperties = {
          fontSize: font.size.xxs,
          color: tokenColor.text3,
          flexShrink: 0,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: 120,
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
              <span style={rankBadgeStyle}>{row.rank}</span>
              <span style={fileIdStyle} title={row.fileId}>
                {row.fileId}
              </span>
            </div>
            <div style={bottomStyle}>
              <ScoreBarMini score={row.score} />
              <span style={descStyle} title={row.description}>
                {row.description}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Arc legend ───────────────────────────────────────────────────────────────

function ArcLegend() {
  const style: CSSProperties = {
    display: "flex",
    gap: 14,
    padding: `${space[1]}px ${space[4]}px`,
    borderTop: `1px solid ${tokenColor.border}`,
    flexShrink: 0,
    background: tokenColor.bg1,
    alignItems: "center",
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
      <div style={entryStyle}>
        <span style={swatchStyle("#0d99ff")} />
        centrality
      </div>
      <div style={entryStyle}>
        <span style={swatchStyle("#22c55e")} />
        entry point
      </div>
      <div style={entryStyle}>
        <span style={swatchStyle("#ef4444")} />
        risk
      </div>
    </div>
  );
}

// ─── "Begin Tour" button ─────────────────────────────────────────────────────

interface BeginTourButtonProps {
  topFileId?: string;
  onFocusEntity?: (id: string) => void;
  onHeroHighlight: (active: boolean) => void;
}

function BeginTourButton({ topFileId, onFocusEntity, onHeroHighlight }: BeginTourButtonProps) {
  const [hovered, setHovered] = useState(false);

  const btnStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "4px 12px",
    borderRadius: radius.pill,
    border: `1.5px solid ${tokenColor.accent}`,
    background: hovered ? tokenColor.accent : "transparent",
    color: hovered ? "#ffffff" : tokenColor.accent,
    fontSize: font.size.xs,
    fontWeight: font.weight.semibold,
    cursor: "pointer",
    transition: `background ${transition.fast}, color ${transition.fast}`,
    lineHeight: 1.4,
    flexShrink: 0,
    fontFamily: font.sans,
  };

  return (
    <button
      style={btnStyle}
      onMouseEnter={() => {
        setHovered(true);
        onHeroHighlight(true);
      }}
      onMouseLeave={() => {
        setHovered(false);
        onHeroHighlight(false);
      }}
      onClick={() => topFileId && onFocusEntity?.(topFileId)}
      disabled={!topFileId}
      aria-label="Begin tour — focus top entry point"
    >
      Begin Tour →
    </button>
  );
}

// ─── Score count-up hook ────────────────────────────────────────────────────

function useScoreCountUp(rows: StartHereRow[], mounted: boolean): Map<string, number> {
  const [countedScores, setCountedScores] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (!mounted) return;

    const top3 = rows.filter(r => r.rank <= 3);
    if (top3.length === 0) return;

    const cleanups: Array<() => void> = [];

    top3.forEach((row) => {
      const delayMs = (row.rank - 1) * 60 + 200;
      const targetValue = Math.round(row.score * 100);
      const durationMs = 500;

      const timeoutId = setTimeout(() => {
        let startTs: number | null = null;
        let rafId = 0;

        const animate = (ts: number) => {
          if (startTs === null) startTs = ts;
          const elapsed = ts - startTs;
          const rawT = Math.min(elapsed / durationMs, 1);
          // cubic ease-in-out
          const t = rawT < 0.5
            ? 2 * rawT * rawT
            : 1 - Math.pow(-2 * rawT + 2, 2) / 2;
          const current = Math.round(t * targetValue);

          setCountedScores(prev => {
            const next = new Map(prev);
            next.set(row.fileId, current);
            return next;
          });

          if (rawT < 1) {
            rafId = requestAnimationFrame(animate);
          }
        };

        rafId = requestAnimationFrame(animate);
        cleanups.push(() => cancelAnimationFrame(rafId));
      }, delayMs);

      cleanups.push(() => clearTimeout(timeoutId));
    });

    return () => {
      cleanups.forEach(fn => fn());
    };
  }, [mounted, rows]);

  return countedScores;
}

// ─── Main view ────────────────────────────────────────────────────────────────

function StartHereViewImpl({
  graph,
  onFocusEntity,
  onDismiss,
}: StartHereViewProps) {
  const [mounted, setMounted] = useState(false);
  const [highlightedRank, setHighlightedRank] = useState<number | null>(null);
  const [heroHighlighted, setHeroHighlighted] = useState(false);
  const layoutRef = useRef<StartHereLayout | null>(null);

  if (layoutRef.current === null) {
    layoutRef.current = buildStartHereLayout({ graph });
  }
  const layout = layoutRef.current;

  useEffect(() => {
    layoutRef.current = buildStartHereLayout({ graph });
  }, [graph]);

  useEffect(() => {
    injectStyles();
    let r1 = 0;
    let r2 = 0;
    r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => setMounted(true));
    });
    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
    };
  }, []);

  // Score count-up
  const countedScores = useScoreCountUp(layout.rows, mounted);

  // Constellation seed derived from graph file count (deterministic)
  const constellationSeed = layout.totalFiles;

  const rootStyle: CSSProperties = {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    background: tokenColor.bg1,
    overflow: "hidden",
    opacity: mounted ? 1 : 0,
    transform: mounted ? "translateY(0)" : "translateY(6px)",
    transition: `opacity ${ENTRY_MS}ms ease-out, transform ${ENTRY_MS}ms ease-out`,
    fontFamily: font.sans,
    position: "relative",
  };

  const headerStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    padding: `${space[2]}px ${space[4]}px`,
    borderBottom: `1px solid ${tokenColor.border}`,
    background: tokenColor.bg1,
    flexShrink: 0,
    gap: space[2],
  };

  const titleBlockStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 1,
    flex: 1,
    minWidth: 0,
  };

  const titleStyle: CSSProperties = {
    fontSize: font.size.lg,
    fontWeight: font.weight.semibold,
    color: tokenColor.text0,
    lineHeight: 1.2,
  };

  const headerSubtitleStyle: CSSProperties = {
    fontSize: font.size.xxs,
    color: tokenColor.text2,
    lineHeight: 1,
  };

  const dismissStyle: CSSProperties = {
    width: 22,
    height: 22,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    color: tokenColor.text2,
    fontSize: font.size.md,
    borderRadius: radius.sm,
    flexShrink: 0,
    background: "transparent",
    border: "none",
    padding: 0,
    lineHeight: 1,
    transition: `background ${transition.fast}, color ${transition.fast}`,
  };

  const bodyStyle: CSSProperties = {
    flex: 1,
    display: "flex",
    flexDirection: "row",
    overflow: "hidden",
    minHeight: 0,
  };

  const mapPaneStyle: CSSProperties = {
    flexBasis: "55%",
    flexShrink: 0,
    overflowY: "auto",
    padding: `${space[3]}px ${space[2]}px`,
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
  };

  const emptyStyle: CSSProperties = {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: space[2],
    fontSize: font.size.md,
    color: tokenColor.text2,
    padding: space[4],
    textAlign: "center",
  };

  const topFileId = layout.rows[0]?.fileId;

  return (
    <div style={rootStyle} role="region" aria-label="Start Here — codebase tour">
      {/* Header */}
      <div style={headerStyle}>
        <div style={titleBlockStyle}>
          <span style={titleStyle}>Start Here</span>
          <span style={headerSubtitleStyle}>
            recommended entry points for codebase onboarding
          </span>
        </div>
        <BeginTourButton
          topFileId={topFileId}
          onFocusEntity={onFocusEntity}
          onHeroHighlight={setHeroHighlighted}
        />
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
          <span>No files to rank</span>
          <span
            style={{ fontSize: font.size.xs, color: tokenColor.text3 }}
          >
            {layout.totalFiles === 0
              ? "Load a workspace to see entry points"
              : "No files qualify as entry points"}
          </span>
        </div>
      ) : (
        <>
          <div style={bodyStyle}>
            {/* Left 55%: SVG journey map */}
            <div style={mapPaneStyle}>
              <JourneyMap
                rows={layout.rows}
                highlightedRank={highlightedRank}
                mounted={mounted}
                heroHighlighted={heroHighlighted}
                countedScores={countedScores}
                onHover={setHighlightedRank}
                onFocusEntity={onFocusEntity}
                constellationSeed={constellationSeed}
              />
            </div>

            {/* Right 45%: detail list */}
            <ListPanel
              rows={layout.rows}
              highlightedRank={highlightedRank}
              onHover={setHighlightedRank}
              onFocusEntity={onFocusEntity}
            />
          </div>

          {/* Arc legend + hint */}
          <ArcLegend />
          <div
            style={{
              padding: `${space[1]}px ${space[4]}px`,
              borderTop: `1px solid ${tokenColor.border}`,
              fontSize: font.size.xxs,
              color: tokenColor.text3,
              flexShrink: 0,
              boxShadow: shadow.xs,
              background: tokenColor.bg1,
            }}
          >
            Hover circle for breakdown · Click to focus on canvas
          </div>
        </>
      )}
    </div>
  );
}

export const StartHereView = memo(StartHereViewImpl);
