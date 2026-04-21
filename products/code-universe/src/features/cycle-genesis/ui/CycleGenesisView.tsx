// CycleGenesisView — "Cycle Birth Timeline" visualization
// --------------------------------------------------------------------
// SOTA++ vertical git-style timeline showing when each import cycle
// first formed.
//
// Layout (top → bottom):
//   1. Header bar — title + subtitle + dismiss button
//   2. Summary strip — pill chips (count, oldest, most-recent)
//   3. Vertical timeline — left time-axis line with red dots + right cards
//   4. Timeline scrubber — range input to snapshot-filter rows
//   5. Empty state — centered green checkmark when no cycles

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { color, font, radius, space, transition } from "../../../shared/ui/tokens";
import type { WorkspaceGraph } from "@quanta/canvas-engine";
import { buildCycleGenesisLayout } from "../model/build-cycle-genesis-layout";
import type { CycleGenesisRow } from "../model/types";

// ── Constants ─────────────────────────────────────────────────────────

const TIME_AXIS_W = 120; // px — left column (date + dot)
const DOT_SIZE = 8;      // px — timeline dot diameter
const ANIM_STAGGER = 50; // ms between row stagger

// ── Style injection (keyframes) ───────────────────────────────────────

const FADE_UP_NAME = "cgv-fadeUp";
const KEYFRAME_CSS = `
@keyframes ${FADE_UP_NAME} {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0);    }
}
`;

const SCRUB_THUMB_CSS = (accentColor: string, accentSoft: string) => `
.cg-range { appearance: none; -webkit-appearance: none; }
.cg-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: ${accentColor};
  cursor: pointer;
  box-shadow: 0 0 0 3px ${accentSoft};
}
.cg-range::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: ${accentColor};
  cursor: pointer;
  box-shadow: 0 0 0 3px ${accentSoft};
  border: none;
}
`;

let _keyframesInjected = false;
function ensureKeyframes(): void {
  if (_keyframesInjected || typeof document === "undefined") return;
  _keyframesInjected = true;
  const style = document.createElement("style");
  style.textContent = KEYFRAME_CSS + SCRUB_THUMB_CSS(color.accent, color.accentSoft);
  document.head.appendChild(style);
}

// ── Prop types ────────────────────────────────────────────────────────

export interface CycleGenesisViewProps {
  graph: WorkspaceGraph;
  onFocusEntity?: (id: string) => void;
  onDismiss?: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────

/** Truncate a file id to the last path segment (without extension). */
function shortName(id: string): string {
  const clean = id.replace(/\.[^./]+$/, "");
  const parts = clean.split("/");
  return parts[parts.length - 1] ?? id;
}

/** Return age badge color based on how many months old something is. */
function ageBadgeColor(months: number): { bg: string; fg: string } {
  if (months > 6) return { bg: "rgba(127,29,29,0.12)", fg: "#991b1b" };
  if (months > 3) return { bg: "rgba(239,68,68,0.12)", fg: "#ef4444" };
  return { bg: "rgba(245,158,11,0.12)", fg: "#d97706" };
}

/** Format a Unix ms timestamp as "Apr 2024"-style short date. */
function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", { year: "numeric", month: "short" });
}

/** Extract approximate month count from an ageLabel like "3 months ago". */
function monthsFromAgeLabel(label: string): number {
  const m = label.match(/(\d+)\s*mo/);
  if (m) return parseInt(m[1], 10);
  const y = label.match(/(\d+)\s*y/);
  if (y) return parseInt(y[1], 10) * 12;
  const w = label.match(/(\d+)\s*w/);
  if (w) return Math.round(parseInt(w[1], 10) / 4.3);
  return 0;
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

// ── Member pill with → focus arrow ────────────────────────────────────

interface MemberPillProps {
  member: string;
  isLast: boolean;
  onFocus: () => void;
}

function MemberPill({ member, isLast, onFocus }: MemberPillProps) {
  const [hovered, setHovered] = useState(false);

  const pillStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    position: "relative",
    paddingLeft: 6,
    paddingRight: hovered ? 22 : 6,
    paddingTop: 2,
    paddingBottom: 2,
    borderRadius: radius.pill,
    backgroundColor: hovered ? color.bg3 : color.bg2,
    fontFamily: font.mono,
    fontSize: font.size.xs,
    color: color.text1,
    cursor: "pointer",
    transition: `background-color ${transition.fast}, padding-right ${transition.fast}`,
    overflow: "hidden",
  };

  const arrowStyle: CSSProperties = {
    position: "absolute",
    right: 5,
    top: "50%",
    transform: hovered ? "translateY(-50%) translateX(0)" : "translateY(-50%) translateX(-4px)",
    opacity: hovered ? 1 : 0,
    transition: `opacity ${transition.fast}, transform ${transition.fast}`,
    fontSize: font.size.xs,
    color: color.accent,
    pointerEvents: "none",
    lineHeight: 1,
  };

  return (
    <span
      style={pillStyle}
      onClick={onFocus}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onFocus(); }}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      {shortName(member)}
      {!isLast && (
        <span style={{ color: color.text3, marginLeft: 3 }}>↔</span>
      )}
      <span style={arrowStyle} aria-hidden="true">→</span>
    </span>
  );
}

// ── SHA chip with copy button ─────────────────────────────────────────

interface ShaChipProps {
  sha: string;
}

function ShaChip({ sha }: ShaChipProps) {
  const [copiedSha, setCopiedSha] = useState<string | null>(null);

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(sha).then(() => {
      setCopiedSha(sha);
      setTimeout(() => setCopiedSha(null), 500);
    });
  }, [sha]);

  const chipStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 3,
    paddingLeft: 5,
    paddingRight: 5,
    paddingTop: 1,
    paddingBottom: 1,
    borderRadius: radius.xs,
    backgroundColor: color.bg3,
    fontFamily: font.mono,
    fontSize: font.size.xs,
    color: color.text2,
    userSelect: "text",
  };

  const copyBtnStyle: CSSProperties = {
    border: "none",
    background: "none",
    padding: 0,
    cursor: "pointer",
    fontSize: 10,
    color: copiedSha ? "#22a06b" : color.text3,
    display: "inline-flex",
    alignItems: "center",
    lineHeight: 1,
    transition: `color ${transition.fast}`,
    flexShrink: 0,
  };

  return (
    <span style={chipStyle}>
      {sha.slice(0, 7)}
      <button
        style={copyBtnStyle}
        onClick={handleCopy}
        aria-label={copiedSha ? "Copied!" : "Copy SHA"}
        title={copiedSha ? "Copied!" : "Copy SHA"}
      >
        {copiedSha ? "✓" : "📋"}
      </button>
    </span>
  );
}

// ── Timeline entry row ────────────────────────────────────────────────

interface TimelineRowProps {
  row: CycleGenesisRow;
  index: number;
  hovered: boolean;
  onHoverEnter: () => void;
  onHoverLeave: () => void;
  onFocusMember: (id: string) => void;
}

function TimelineRow({
  row,
  index,
  hovered,
  onHoverEnter,
  onHoverLeave,
  onFocusMember,
}: TimelineRowProps) {
  const months = monthsFromAgeLabel(row.ageLabel);
  const { bg: ageBg, fg: ageFg } = ageBadgeColor(months);

  // Container — full row
  const rowStyle: CSSProperties = {
    display: "flex",
    alignItems: "flex-start",
    gap: 0,
    borderLeft: hovered ? `4px solid ${color.accent}` : "4px solid transparent",
    backgroundColor: hovered ? color.bg1 : "transparent",
    borderRadius: radius.sm,
    transition: `border-color ${transition.fast}, background-color ${transition.fast}`,
    animation: `${FADE_UP_NAME} 250ms ease-out both`,
    animationDelay: `${index * ANIM_STAGGER}ms`,
    opacity: row.predatesHistory ? 0.6 : 1,
    position: "relative",
    cursor: "default",
  };

  // Left column — time axis (date + dot)
  const leftColStyle: CSSProperties = {
    width: TIME_AXIS_W,
    minWidth: TIME_AXIS_W,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    paddingRight: space[3],
    paddingTop: space[2],
    paddingBottom: space[2],
    position: "relative",
    flexShrink: 0,
  };

  const dateStyle: CSSProperties = {
    fontFamily: font.mono,
    fontSize: font.size.xs,
    color: color.text2,
    userSelect: "none",
    lineHeight: 1,
    marginBottom: 4,
  };

  // Dot positioned to align with the vertical axis line
  const dotWrapStyle: CSSProperties = {
    position: "absolute",
    right: -DOT_SIZE / 2 - 1, // center on the axis line
    top: space[2] + 2,
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: radius.pill,
    backgroundColor: row.predatesHistory ? "transparent" : "#ef4444",
    border: row.predatesHistory ? `1.5px dashed #ef4444` : "none",
    zIndex: 1,
    transition: `box-shadow ${transition.fast}`,
    boxShadow: hovered ? `0 0 0 3px rgba(239,68,68,0.18)` : "none",
  };

  // Right content card
  const cardStyle: CSSProperties = {
    flex: 1,
    minWidth: 0,
    paddingLeft: space[3],
    paddingRight: space[3],
    paddingTop: space[2],
    paddingBottom: space[2],
    display: "flex",
    flexDirection: "column",
    gap: 4,
    fontStyle: row.predatesHistory ? "italic" : "normal",
  };

  // Member pills row
  const pillsRowStyle: CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    gap: 4,
    alignItems: "center",
  };

  const edgeStyle: CSSProperties = {
    fontFamily: font.mono,
    fontSize: font.size.xs,
    color: color.text2,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };

  const metaRowStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: space[2],
    flexWrap: "wrap",
  };

  const ageBadgeStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    paddingLeft: 5,
    paddingRight: 5,
    paddingTop: 1,
    paddingBottom: 1,
    borderRadius: radius.pill,
    backgroundColor: ageBg,
    fontFamily: font.sans,
    fontSize: font.size.xs,
    fontWeight: font.weight.semibold,
    color: ageFg,
    userSelect: "none",
  };

  const predatesLabel: CSSProperties = {
    fontFamily: font.sans,
    fontSize: font.size.xs,
    color: color.text3,
    fontStyle: "italic",
  };

  return (
    <div
      style={rowStyle}
      onPointerEnter={onHoverEnter}
      onPointerLeave={onHoverLeave}
      role="listitem"
    >
      {/* LEFT — time axis column */}
      <div style={leftColStyle}>
        <span style={dateStyle}>
          {row.formedAtTimestamp !== null ? fmtDate(row.formedAtTimestamp) : "Before history"}
        </span>
        {/* Dot (positioned absolute) */}
        <div style={dotWrapStyle} aria-hidden="true" />
      </div>

      {/* RIGHT — content card */}
      <div style={cardStyle}>
        {/* Top row: SHA chip + age badge */}
        <div style={metaRowStyle}>
          {row.formedAtSha && (
            <ShaChip sha={row.formedAtSha} />
          )}
          {row.predatesHistory ? (
            <span style={predatesLabel}>Pre-dates recorded history</span>
          ) : (
            <span style={ageBadgeStyle}>{months > 0 ? `${months}mo ago` : row.ageLabel}</span>
          )}
        </div>

        {/* Member pills */}
        <div style={pillsRowStyle} title={row.sccMembers.join(" ↔ ")}>
          {row.sccMembers.map((m, idx) => (
            <MemberPill
              key={m}
              member={m}
              isLast={idx === row.sccMembers.length - 1}
              onFocus={() => onFocusMember(m)}
            />
          ))}
        </div>

        {/* Introducing edge */}
        {row.introducingEdge && (
          <span
            style={edgeStyle}
            title={`${row.introducingEdge.from} → ${row.introducingEdge.to}`}
          >
            introducing edge:&nbsp;
            <strong style={{ color: color.text1 }}>
              {shortName(row.introducingEdge.from)}
            </strong>
            &nbsp;→&nbsp;
            <strong style={{ color: color.text1 }}>
              {shortName(row.introducingEdge.to)}
            </strong>
          </span>
        )}
      </div>
    </div>
  );
}

// ── Vertical axis line wrapper ────────────────────────────────────────
// Renders the continuous vertical line through all timeline rows,
// with an animated draw on mount.

interface TimelineAxisProps {
  children: React.ReactNode;
  rowCount: number;
  mounted: boolean;
}

function TimelineAxis({ children, rowCount, mounted }: TimelineAxisProps) {
  const outerStyle: CSSProperties = {
    position: "relative",
  };

  // Animated axis line: starts at height 0, grows to 100%
  const lineStyle: CSSProperties = {
    position: "absolute",
    top: 0,
    left: TIME_AXIS_W - 1,
    width: 2,
    height: mounted ? "100%" : 0,
    backgroundColor: color.border,
    pointerEvents: "none",
    borderRadius: radius.pill,
    transition: `height ${rowCount * 60}ms ease-out 200ms`,
  };

  return (
    <div style={outerStyle}>
      <div style={lineStyle} aria-hidden="true" />
      {children}
    </div>
  );
}

// ── Timeline scrubber ─────────────────────────────────────────────────

interface ScrubberProps {
  value: number;
  max: number;
  onChange: (val: number) => void;
}

function TimelineScrubber({ value, max, onChange }: ScrubberProps) {
  const wrapStyle: CSSProperties = {
    paddingLeft: space[3],
    paddingRight: space[3],
    paddingTop: space[2],
    paddingBottom: space[2],
    borderTop: `1px solid ${color.border}`,
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  };

  const labelStyle: CSSProperties = {
    fontFamily: font.sans,
    fontSize: font.size.xs,
    color: color.text2,
    userSelect: "none",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  };

  const rangeStyle: CSSProperties = {
    appearance: "none",
    WebkitAppearance: "none",
    width: "100%",
    height: 4,
    borderRadius: radius.pill,
    background: color.bg3,
    cursor: "pointer",
    outline: "none",
    border: "none",
  };

  return (
    <div style={wrapStyle}>
      <div style={labelStyle}>
        <span>Timeline snapshot</span>
        <span style={{ color: color.text1, fontWeight: font.weight.semibold }}>
          {value + 1} of {max + 1}
        </span>
      </div>
      <input
        type="range"
        className="cg-range"
        style={rangeStyle}
        min={0}
        max={max}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        aria-label={`Snapshot ${value + 1} of ${max + 1}`}
      />
    </div>
  );
}

// ── Summary strip ─────────────────────────────────────────────────────

interface SummaryStripProps {
  rows: readonly CycleGenesisRow[];
}

function SummaryStrip({ rows }: SummaryStripProps) {
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

  const countChip =
    rows.length === 0
      ? { label: "No cycles ✓", bg: "rgba(34,160,107,0.12)", fg: "#22a06b" }
      : { label: `${rows.length} active cycle${rows.length !== 1 ? "s" : ""}`, bg: "rgba(239,68,68,0.12)", fg: "#ef4444" };

  // Oldest cycle (lowest timestamp)
  const datedRows = rows.filter(r => r.formedAtTimestamp !== null);
  const oldest = datedRows.length > 0
    ? datedRows.reduce((a, b) => (a.formedAtTimestamp! < b.formedAtTimestamp! ? a : b))
    : null;
  const newest = datedRows.length > 0
    ? datedRows.reduce((a, b) => (a.formedAtTimestamp! > b.formedAtTimestamp! ? a : b))
    : null;

  return (
    <div style={stripStyle}>
      <PillChip {...countChip} />
      {oldest && (
        <PillChip
          label={`oldest: ${oldest.ageLabel}`}
          bg="rgba(245,158,11,0.10)"
          fg="#d97706"
        />
      )}
      {newest && newest.id !== oldest?.id && (
        <PillChip
          label={`most recent: ${newest.ageLabel}`}
          bg="rgba(13,153,255,0.10)"
          fg="#0d99ff"
        />
      )}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────

function EmptyState() {
  const wrapStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: space[7],
    gap: space[3],
  };

  const iconStyle: CSSProperties = {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: "rgba(34,160,107,0.12)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const headingStyle: CSSProperties = {
    fontFamily: font.sans,
    fontSize: font.size.md,
    fontWeight: font.weight.semibold,
    color: "#22a06b",
    textAlign: "center",
  };

  const subStyle: CSSProperties = {
    fontFamily: font.sans,
    fontSize: font.size.sm,
    color: color.text2,
    textAlign: "center",
  };

  return (
    <div style={wrapStyle}>
      <div style={iconStyle}>
        {/* Checkmark SVG */}
        <svg width={24} height={24} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M5 13l4 4L19 7"
            stroke="#22a06b"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div style={headingStyle}>No cycles detected</div>
      <div style={subStyle}>All dependencies are acyclic ✓</div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────

function CycleGenesisViewImpl({
  graph,
  onFocusEntity,
  onDismiss,
}: CycleGenesisViewProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const layout = useMemo(
    () => buildCycleGenesisLayout({ graph }),
    [graph],
  );

  const [scrubberIdx, setScrubberIdx] = useState(() => Math.max(0, layout.rows.length - 1));

  // Keep scrubberIdx in bounds if layout changes
  const clampedScrubberIdx = Math.min(scrubberIdx, Math.max(0, layout.rows.length - 1));

  useEffect(() => {
    ensureKeyframes();
    // Trigger axis line animation after a short delay
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Update scrubberIdx default when layout changes (new graph)
  useEffect(() => {
    setScrubberIdx(Math.max(0, layout.rows.length - 1));
  }, [layout.rows.length]);

  const handleFocusMember = useCallback(
    (memberId: string) => onFocusEntity?.(memberId),
    [onFocusEntity],
  );

  // Filter rows by scrubber: show rows up to and including scrubberIdx
  const visibleRows = useMemo(
    () => layout.rows.filter((_row, i) => i <= clampedScrubberIdx),
    [layout.rows, clampedScrubberIdx],
  );

  // ── Shared styles ──────────────────────────────────────────────────

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

  const bodyStyle: CSSProperties = {
    overflowY: "auto",
    overflowX: "hidden",
    flex: 1,
    paddingTop: space[2],
    paddingBottom: space[2],
    paddingLeft: space[2],
    paddingRight: space[2],
  };

  return (
    <div style={rootStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={titleBlockStyle}>
          <span style={titleStyle}>Cycle Birth Timeline</span>
          <span style={subtitleStyle}>when each dependency cycle first formed</span>
        </div>
        {onDismiss && (
          <button style={dismissBtnStyle} onClick={onDismiss} aria-label="Dismiss">
            &#x2715;
          </button>
        )}
      </div>

      {/* Summary strip */}
      <SummaryStrip rows={layout.rows} />

      {/* Body */}
      {layout.rows.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div style={bodyStyle} role="list" aria-label="Cycle birth timeline">
            <TimelineAxis rowCount={visibleRows.length} mounted={mounted}>
              {visibleRows.map((row, i) => (
                <TimelineRow
                  key={row.id}
                  row={row}
                  index={i}
                  hovered={hoveredId === row.id}
                  onHoverEnter={() => setHoveredId(row.id)}
                  onHoverLeave={() => setHoveredId(null)}
                  onFocusMember={handleFocusMember}
                />
              ))}
            </TimelineAxis>
          </div>

          {/* Timeline scrubber — show only if more than 1 row */}
          {layout.rows.length > 1 && (
            <TimelineScrubber
              value={clampedScrubberIdx}
              max={layout.rows.length - 1}
              onChange={setScrubberIdx}
            />
          )}
        </>
      )}
    </div>
  );
}

export const CycleGenesisView = memo(CycleGenesisViewImpl);
