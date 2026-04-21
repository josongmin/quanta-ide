// SmellHistoryView — "Smell History" visualization
// --------------------------------------------------------------------
// SOTA++ visualization showing when code smells first appeared.
//
// Layout (top → bottom):
//   1. Header bar — title + subtitle + dismiss button
//   2. Summary strip — total smells + files affected chips
//   3. Sparkline — 64px SVG area chart with hover cursor + tooltip
//   4. Section groups — colored left-border accent bar + trend indicator
//   5. Entry rows — dot + filename + age + hover-reveal SHA chip
//   6. Empty state per section

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties, MouseEvent } from "react";
import { color, font, radius, space, transition } from "../../../shared/ui/tokens";
import type { WorkspaceGraph } from "@quanta/canvas-engine";
import type { SmellKind } from "@quanta/canvas-engine";
import { buildSmellHistoryLayout } from "../model/build-smell-history-layout";
import type { SmellHistoryEntry, SparklineBucket } from "../model/types";

// ── Constants ─────────────────────────────────────────────────────────

const SPARKLINE_H = 64;
const ANIM_STAGGER = 30; // ms between row stagger

// ── Style injection (keyframes) ───────────────────────────────────────

const FADE_UP_NAME = "shv-fadeUp";
const KEYFRAME_CSS = `
@keyframes ${FADE_UP_NAME} {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0);    }
}
`;

let _keyframesInjected = false;
function ensureKeyframes(): void {
  if (_keyframesInjected || typeof document === "undefined") return;
  _keyframesInjected = true;
  const style = document.createElement("style");
  style.textContent = KEYFRAME_CSS;
  document.head.appendChild(style);
}

// ── Prop types ────────────────────────────────────────────────────────

export interface SmellHistoryViewProps {
  graph: WorkspaceGraph;
  onFocusEntity?: (id: string) => void;
  onDismiss?: () => void;
}

// ── Smell section metadata ────────────────────────────────────────────

interface SmellSectionMeta {
  kind: SmellKind;
  label: string;
  description: string;
  accentColor: string;
}

const SMELL_SECTIONS: readonly SmellSectionMeta[] = [
  {
    kind: "high-coupling",
    label: "High Coupling",
    description: "Files with too many dependencies",
    accentColor: "#f59e0b",
  },
  {
    kind: "cycle-member",
    label: "Cycle Member",
    description: "Files participating in import cycles",
    accentColor: "#ef4444",
  },
  {
    kind: "risk-spike",
    label: "Risk Spike",
    description: "Files whose risk score jumped significantly",
    accentColor: "#f97316",
  },
  {
    kind: "layer-violation",
    label: "Layer Violation",
    description: "Files that break architectural layer rules",
    accentColor: "#8b5cf6",
  },
];

// ── Helpers ───────────────────────────────────────────────────────────

function hexToAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Age badge: green < 30d, amber 30-90d, red > 90d */
function ageBadgeColors(timestamp: number): { bg: string; fg: string } {
  const daysAgo = (Date.now() - timestamp) / 86_400_000;
  if (daysAgo <= 30) return { bg: "rgba(34,160,107,0.12)", fg: "#22a06b" };
  if (daysAgo <= 90) return { bg: "rgba(245,158,11,0.12)", fg: "#d97706" };
  return { bg: "rgba(239,68,68,0.12)", fg: "#ef4444" };
}

/** Trend direction: looks at last 3 buckets. */
type TrendDir = "up" | "stable" | "down";
function computeTrend(buckets: SparklineBucket[]): TrendDir {
  if (buckets.length < 3) return "stable";
  const last3 = buckets.slice(-3).map(b => b.count);
  if (last3[2] > last3[1] && last3[1] >= last3[0]) return "up";
  if (last3[2] < last3[1] && last3[1] <= last3[0]) return "down";
  return "stable";
}

// ── Summary pill chip ─────────────────────────────────────────────────

interface PillChipProps {
  label: string;
  bg: string;
  fg: string;
}

function PillChip({ label, bg, fg }: PillChipProps) {
  const style: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    paddingLeft: space[2],
    paddingRight: space[2],
    paddingTop: 3,
    paddingBottom: 3,
    borderRadius: radius.pill,
    backgroundColor: bg,
    color: fg,
    fontFamily: font.sans,
    fontSize: font.size.xs,
    fontWeight: font.weight.semibold,
    userSelect: "none",
    whiteSpace: "nowrap",
  };
  return <span style={style}>{label}</span>;
}

// ── Sparkline with hover cursor ───────────────────────────────────────

interface SparklineProps {
  buckets: SparklineBucket[];
}

function Sparkline({ buckets }: SparklineProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [cursorX, setCursorX] = useState<number | null>(null);
  const [tooltipIdx, setTooltipIdx] = useState<number | null>(null);

  if (buckets.length === 0) return null;

  const W = 400; // viewBox width (scales with SVG)
  const H = SPARKLINE_H;
  const padX = 4;
  const padY = 6;
  const usableW = W - padX * 2;
  const usableH = H - padY * 2;
  const maxCount = Math.max(...buckets.map(b => b.count), 1);

  const pts = buckets.map((b, i) => {
    const x = padX + (i / (buckets.length - 1 || 1)) * usableW;
    const y = padY + usableH - (b.count / maxCount) * usableH;
    return { x, y, count: b.count, index: i };
  });

  const polyPoints = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  const areaPath =
    `M ${pts[0].x.toFixed(1)},${H} ` +
    pts.map(p => `L ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") +
    ` L ${pts[pts.length - 1].x.toFixed(1)},${H} Z`;

  const gradId = "shv-sparkline-grad";

  const handleMouseMove = useCallback((e: MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const fraction = relX / rect.width;
    const viewX = padX + fraction * usableW;
    setCursorX(viewX);
    // Find closest bucket
    let closest = 0;
    let minDist = Infinity;
    pts.forEach((p, i) => {
      const dist = Math.abs(p.x - viewX);
      if (dist < minDist) { minDist = dist; closest = i; }
    });
    setTooltipIdx(closest);
  }, [pts, usableW]);

  const handleMouseLeave = useCallback(() => {
    setCursorX(null);
    setTooltipIdx(null);
  }, []);

  const tooltipBucket = tooltipIdx !== null ? buckets[tooltipIdx] : null;
  const tooltipPt = tooltipIdx !== null ? pts[tooltipIdx] : null;

  return (
    <div style={{ position: "relative" }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        width="100%"
        height={H}
        style={{ display: "block", cursor: "crosshair" }}
        aria-label="Smell count over time"
        role="img"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color.accent} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color.accent} stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* Area fill */}
        <path d={areaPath} fill={`url(#${gradId})`} />

        {/* Polyline */}
        <polyline
          points={polyPoints}
          fill="none"
          stroke={color.accent}
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          opacity={0.85}
        />

        {/* Dots — colored by worst smell kind in bucket (use accent as fallback) */}
        {pts.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={2.5}
            fill={color.accent}
            opacity={tooltipIdx === i ? 1 : 0.5}
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {/* Hover cursor vertical line */}
        {cursorX !== null && (
          <line
            x1={cursorX}
            y1={padY}
            x2={cursorX}
            y2={H - padY}
            stroke={color.text2}
            strokeWidth={1}
            strokeDasharray="2,2"
            vectorEffect="non-scaling-stroke"
          />
        )}

        {/* Baseline */}
        <line
          x1={padX}
          y1={H - 2}
          x2={W - padX}
          y2={H - 2}
          stroke={color.border}
          strokeWidth={0.5}
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/* Tooltip */}
      {tooltipBucket !== null && tooltipPt !== null && (
        <div
          style={{
            position: "absolute",
            top: 4,
            // Position tooltip: if bucket in left half, show right; else left
            ...(tooltipIdx !== null && tooltipIdx < buckets.length / 2
              ? { left: "50%" }
              : { right: "50%" }),
            background: color.bg0,
            border: `1px solid ${color.border}`,
            borderRadius: radius.sm,
            padding: `3px ${space[2]}px`,
            fontFamily: font.sans,
            fontSize: font.size.xs,
            color: color.text1,
            pointerEvents: "none",
            whiteSpace: "nowrap",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            zIndex: 10,
          }}
          aria-hidden="true"
        >
          {tooltipBucket.count} smell{tooltipBucket.count !== 1 ? "s" : ""} at this snapshot
        </div>
      )}
    </div>
  );
}

// ── Single entry row ──────────────────────────────────────────────────

interface EntryRowProps {
  entry: SmellHistoryEntry;
  index: number;
  hovered: boolean;
  onHoverEnter: () => void;
  onHoverLeave: () => void;
  onFocus: () => void;
}

function EntryRow({
  entry,
  index,
  hovered,
  onHoverEnter,
  onHoverLeave,
  onFocus,
}: EntryRowProps) {
  const { bg: ageBg, fg: ageFg } = ageBadgeColors(entry.firstSeenTimestamp);

  const rowStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: space[2],
    paddingLeft: space[3],
    paddingRight: space[3],
    paddingTop: 5,
    paddingBottom: 5,
    borderRadius: radius.sm,
    backgroundColor: hovered ? color.hover : "transparent",
    transition: `background-color ${transition.fast}`,
    cursor: "pointer",
    animation: `${FADE_UP_NAME} 250ms ease-out both`,
    animationDelay: `${index * ANIM_STAGGER}ms`,
  };

  const dotStyle: CSSProperties = {
    width: 8,
    height: 8,
    minWidth: 8,
    borderRadius: radius.pill,
    backgroundColor: entry.color,
    flexShrink: 0,
  };

  const fileNameStyle: CSSProperties = {
    fontFamily: font.mono,
    fontSize: font.size.xs,
    fontWeight: font.weight.medium,
    color: hovered ? color.text0 : color.text1,
    flex: 1,
    minWidth: 0,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    transition: `color ${transition.fast}`,
  };

  const ageBadgeStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    paddingLeft: 5,
    paddingRight: 5,
    paddingTop: 2,
    paddingBottom: 2,
    borderRadius: radius.pill,
    backgroundColor: ageBg,
    color: ageFg,
    fontFamily: font.sans,
    fontSize: font.size.xs,
    fontWeight: font.weight.semibold,
    flexShrink: 0,
    userSelect: "none",
  };

  const shaChipStyle: CSSProperties = {
    fontFamily: font.mono,
    fontSize: font.size.xs,
    color: color.text3,
    backgroundColor: color.bg3,
    borderRadius: radius.xs,
    paddingLeft: 4,
    paddingRight: 4,
    paddingTop: 1,
    paddingBottom: 1,
    flexShrink: 0,
    opacity: hovered ? 1 : 0,
    transition: `opacity ${transition.fast}`,
    userSelect: "text",
  };

  return (
    <div
      style={rowStyle}
      onPointerEnter={onHoverEnter}
      onPointerLeave={onHoverLeave}
      onClick={onFocus}
      title={entry.fileId}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onFocus(); }}
    >
      <div style={dotStyle} aria-hidden="true" />
      <span style={fileNameStyle}>{entry.fileName}</span>
      <span style={ageBadgeStyle}>{entry.age}</span>
      <span style={shaChipStyle} aria-hidden={!hovered}>
        {entry.firstSeenSha.slice(0, 7)}
      </span>
    </div>
  );
}

// ── Trend indicator ───────────────────────────────────────────────────

interface TrendBadgeProps {
  dir: TrendDir;
}

function TrendBadge({ dir }: TrendBadgeProps) {
  const configs: Record<TrendDir, { label: string; fg: string; bg: string }> = {
    up:     { label: "↑ accelerating", fg: "#ef4444", bg: "rgba(239,68,68,0.10)" },
    stable: { label: "→ stable",       fg: "#757575", bg: "rgba(117,117,117,0.10)" },
    down:   { label: "↓ declining",    fg: "#22a06b", bg: "rgba(34,160,107,0.10)" },
  };
  const cfg = configs[dir];

  const style: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    paddingLeft: 5,
    paddingRight: 5,
    paddingTop: 1,
    paddingBottom: 1,
    borderRadius: radius.pill,
    backgroundColor: cfg.bg,
    color: cfg.fg,
    fontFamily: font.sans,
    fontSize: font.size.xs,
    fontWeight: font.weight.semibold,
    userSelect: "none",
  };

  return <span style={style}>{cfg.label}</span>;
}

// ── Smell section ─────────────────────────────────────────────────────

interface SmellSectionProps {
  meta: SmellSectionMeta;
  entries: SmellHistoryEntry[];
  sparklineBuckets: SparklineBucket[];
  hoveredId: string | null;
  onHoverEnter: (id: string) => void;
  onHoverLeave: () => void;
  onFocus: (fileId: string) => void;
  entryOffset: number; // global entry index offset for stagger
}

function SmellSection({
  meta,
  entries,
  sparklineBuckets,
  hoveredId,
  onHoverEnter,
  onHoverLeave,
  onFocus,
  entryOffset,
}: SmellSectionProps) {
  const trend = computeTrend(sparklineBuckets);

  const sectionStyle: CSSProperties = {
    borderLeft: `4px solid ${meta.accentColor}`,
    marginLeft: space[3],
    marginRight: space[3],
    marginBottom: space[2],
    borderRadius: `0 ${radius.sm}px ${radius.sm}px 0`,
    overflow: "hidden",
  };

  const headerStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: space[2],
    paddingLeft: space[2],
    paddingRight: space[2],
    paddingTop: space[2],
    paddingBottom: space[2],
    backgroundColor: hexToAlpha(meta.accentColor, 0.04),
  };

  const sectionLabelStyle: CSSProperties = {
    fontFamily: font.sans,
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
    color: meta.accentColor,
    userSelect: "none",
    flex: 1,
  };

  const countBadgeStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    paddingLeft: 5,
    paddingRight: 5,
    paddingTop: 1,
    paddingBottom: 1,
    borderRadius: radius.pill,
    backgroundColor: hexToAlpha(meta.accentColor, 0.12),
    color: meta.accentColor,
    fontFamily: font.sans,
    fontSize: font.size.xs,
    fontWeight: font.weight.semibold,
    userSelect: "none",
  };

  const emptyStyle: CSSProperties = {
    paddingLeft: space[3],
    paddingRight: space[3],
    paddingTop: space[2],
    paddingBottom: space[2],
    fontFamily: font.sans,
    fontSize: font.size.xs,
    color: color.text3,
    fontStyle: "italic",
  };

  return (
    <section style={sectionStyle} aria-label={`${meta.label} smells`}>
      <div style={headerStyle}>
        <span style={sectionLabelStyle}>{meta.label}</span>
        {entries.length > 0 && (
          <span style={countBadgeStyle}>{entries.length}</span>
        )}
        <TrendBadge dir={trend} />
      </div>

      {entries.length === 0 ? (
        <div style={emptyStyle}>No {meta.label.toLowerCase()} smells found</div>
      ) : (
        entries.map((entry, i) => (
          <EntryRow
            key={entry.id}
            entry={entry}
            index={entryOffset + i}
            hovered={hoveredId === entry.id}
            onHoverEnter={() => onHoverEnter(entry.id)}
            onHoverLeave={onHoverLeave}
            onFocus={() => onFocus(entry.fileId)}
          />
        ))
      )}
    </section>
  );
}

// ── Summary strip ─────────────────────────────────────────────────────

interface SummaryStripProps {
  totalSmells: number;
  filesAffected: number;
}

function SummaryStrip({ totalSmells, filesAffected }: SummaryStripProps) {
  const stripStyle: CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: space[1],
    paddingLeft: space[3],
    paddingRight: space[3],
    paddingTop: space[2],
    paddingBottom: space[2],
    borderBottom: `1px solid ${color.border}`,
    flexShrink: 0,
  };

  return (
    <div style={stripStyle}>
      <PillChip
        label={`${totalSmells} smell${totalSmells !== 1 ? "s" : ""}`}
        bg={totalSmells > 0 ? "rgba(239,68,68,0.10)" : "rgba(34,160,107,0.10)"}
        fg={totalSmells > 0 ? "#ef4444" : "#22a06b"}
      />
      <PillChip
        label={`${filesAffected} file${filesAffected !== 1 ? "s" : ""} affected`}
        bg="rgba(13,153,255,0.10)"
        fg="#0d99ff"
      />
    </div>
  );
}

// ── Sparkline header strip ────────────────────────────────────────────

interface SparklineHeaderProps {
  buckets: SparklineBucket[];
}

function SparklineHeader({ buckets }: SparklineHeaderProps) {
  const containerStyle: CSSProperties = {
    paddingLeft: space[3],
    paddingRight: space[3],
    paddingTop: space[2],
    paddingBottom: space[2],
    borderBottom: `1px solid ${color.border}`,
    flexShrink: 0,
  };

  const labelStyle: CSSProperties = {
    fontFamily: font.sans,
    fontSize: font.size.xs,
    color: color.text2,
    userSelect: "none",
    marginBottom: 4,
    display: "block",
  };

  return (
    <div style={containerStyle}>
      <span style={labelStyle}>Smell trend over time</span>
      <Sparkline buckets={buckets} />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────

function SmellHistoryViewImpl({
  graph,
  onFocusEntity,
  onDismiss,
}: SmellHistoryViewProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => { ensureKeyframes(); }, []);

  const layout = useMemo(
    () => buildSmellHistoryLayout({ graph }),
    [graph],
  );

  const handleHoverEnter = useCallback((id: string) => setHoveredId(id), []);
  const handleHoverLeave = useCallback(() => setHoveredId(null), []);
  const handleFocus = useCallback(
    (fileId: string) => onFocusEntity?.(fileId),
    [onFocusEntity],
  );

  // Count unique files affected
  const filesAffected = useMemo(
    () => new Set(layout.entries.map(e => e.fileId)).size,
    [layout.entries],
  );

  const rootStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    width: "100%",
    height: "100%",
    fontFamily: font.sans,
    animation: `${FADE_UP_NAME} 250ms ease-out both`,
  };

  const headerStyle: CSSProperties = {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingLeft: space[3],
    paddingRight: space[3],
    paddingTop: space[3],
    paddingBottom: space[2],
    borderBottom: `1px solid ${color.border}`,
    flexShrink: 0,
    gap: space[2],
  };

  const titleBlockStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 2,
  };

  const titleStyle: CSSProperties = {
    fontFamily: font.sans,
    fontSize: font.size.md,
    fontWeight: font.weight.semibold,
    color: color.text0,
    letterSpacing: font.letter.tight,
    userSelect: "none",
    lineHeight: 1.3,
  };

  const subtitleStyle: CSSProperties = {
    fontFamily: font.sans,
    fontSize: font.size.xs,
    color: color.text2,
    userSelect: "none",
  };

  const dismissBtnStyle: CSSProperties = {
    border: "none",
    background: "none",
    cursor: "pointer",
    color: color.text2,
    fontSize: font.size.xl,
    lineHeight: 1,
    padding: `${space[1]}px`,
    borderRadius: radius.sm,
    display: "flex",
    alignItems: "center",
    flexShrink: 0,
    transition: `color ${transition.fast}`,
  };

  // ── No history guard ───────────────────────────────────────────────

  if (!graph.history) {
    const noHistoryStyle: CSSProperties = {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: space[7],
      gap: space[3],
    };
    const noHistoryTextStyle: CSSProperties = {
      fontFamily: font.sans,
      fontSize: font.size.sm,
      color: color.text3,
      textAlign: "center",
    };

    return (
      <div style={rootStyle}>
        <div style={headerStyle}>
          <div style={titleBlockStyle}>
            <span style={titleStyle}>Smell History</span>
            <span style={subtitleStyle}>first appearance of each code smell</span>
          </div>
          {onDismiss && (
            <button style={dismissBtnStyle} onClick={onDismiss} aria-label="Dismiss">
              &#x2715;
            </button>
          )}
        </div>
        <div style={noHistoryStyle}>
          <div style={noHistoryTextStyle}>
            No history available — temporal smell analysis requires commit history.
          </div>
        </div>
      </div>
    );
  }

  // ── Body ───────────────────────────────────────────────────────────

  const bodyStyle: CSSProperties = {
    overflowY: "auto",
    overflowX: "hidden",
    flex: 1,
    paddingTop: space[2],
    paddingBottom: space[2],
  };

  // Compute cumulative entry offsets for stagger
  let entryOffset = 0;

  return (
    <div style={rootStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={titleBlockStyle}>
          <span style={titleStyle}>Smell History</span>
          <span style={subtitleStyle}>first appearance of each code smell</span>
        </div>
        {onDismiss && (
          <button style={dismissBtnStyle} onClick={onDismiss} aria-label="Dismiss">
            &#x2715;
          </button>
        )}
      </div>

      {/* Summary chips */}
      <SummaryStrip totalSmells={layout.entries.length} filesAffected={filesAffected} />

      {/* Sparkline */}
      <SparklineHeader buckets={layout.sparkline} />

      {/* Grouped smell sections */}
      <div style={bodyStyle} role="list" aria-label="Smell history sections">
        {SMELL_SECTIONS.map(meta => {
          const entries = layout.byKind.get(meta.kind) ?? [];
          const offset = entryOffset;
          entryOffset += entries.length;
          return (
            <SmellSection
              key={meta.kind}
              meta={meta}
              entries={entries}
              sparklineBuckets={layout.sparkline}
              hoveredId={hoveredId}
              onHoverEnter={handleHoverEnter}
              onHoverLeave={handleHoverLeave}
              onFocus={handleFocus}
              entryOffset={offset}
            />
          );
        })}
      </div>
    </div>
  );
}

export const SmellHistoryView = memo(SmellHistoryViewImpl);
