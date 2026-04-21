// CycleGenesisView — "Cycle Birth Timeline" visualization
// --------------------------------------------------------------------
// SOTA++ timeline UI showing when each import cycle first formed.
//
// Layout (top → bottom):
//   1. Header bar — title + dismiss button
//   2. Timeline SVG — horizontal axis with a dot per cycle lane
//   3. Row list — left: member label; centre: timeline dot; right: age + edge
//   4. Empty state — green "No cycles detected" badge
//
// Each timeline lane row has three zones:
//   Left   (35%) — SCC member names, clickable to focus
//   Centre (30%) — timeline SVG strip (dot on axis)
//   Right  (35%) — age label + introducing edge notation
//
// Hover: hovering a row highlights the timeline dot and dims others.

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { color, font, radius, space } from "../../../shared/ui/tokens";
import type { WorkspaceGraph } from "@quanta/canvas-engine";
import { buildCycleGenesisLayout } from "../model/build-cycle-genesis-layout";
import type { CycleGenesisRow } from "../model/types";

// ── Constants ─────────────────────────────────────────────────────────

const ENTRY_MS = 260;
const TIMELINE_H = 32;       // px height of the SVG timeline strip per row
const DOT_R_AMBIENT = 5;     // circle radius — idle
const DOT_R_HOVER = 7;       // circle radius — hovered
const AXIS_Y = TIMELINE_H / 2;
const LABEL_PAD_LEFT = 12;   // px left padding for member label
const LABEL_PAD_RIGHT = 12;  // px right padding for age label

// ── Prop types ────────────────────────────────────────────────────────

export interface CycleGenesisViewProps {
  graph: WorkspaceGraph;
  onFocusEntity?: (id: string) => void;
  onDismiss?: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────

/** Truncate file id to a short display token. */
function shortId(id: string): string {
  const clean = id.replace(/\.[^./]+$/, "");
  const parts = clean.split("/");
  return parts.slice(-2).join("/");
}

// ── Timeline strip component (SVG) ────────────────────────────────────

interface TimelineStripProps {
  row: CycleGenesisRow;
  hovered: boolean;
  allDimmed: boolean;
}

function TimelineStrip({ row, hovered, allDimmed }: TimelineStripProps) {
  const dotR = hovered ? DOT_R_HOVER : DOT_R_AMBIENT;
  const dotOpacity = allDimmed && !hovered ? 0.2 : 1;
  const axisOpacity = allDimmed && !hovered ? 0.15 : 0.35;

  // The dot x inside this strip is computed from timelineX.
  // We map [0..1] to [DOT_R_HOVER + 2 .. stripWidth - DOT_R_HOVER - 2]
  // but since we don't know px width here (SVG is 100% width), we express
  // it as a percentage viewBox. Use viewBox="0 0 100 32" with preserveAspectRatio=none.
  const PAD = 4; // % padding on each side
  const dotX = PAD + row.timelineX * (100 - PAD * 2);

  return (
    <svg
      viewBox={`0 0 100 ${TIMELINE_H}`}
      preserveAspectRatio="none"
      width="100%"
      height={TIMELINE_H}
      style={{ display: "block", overflow: "visible" }}
      aria-hidden="true"
    >
      {/* Axis line */}
      <line
        x1={0}
        y1={AXIS_Y}
        x2={100}
        y2={AXIS_Y}
        stroke={color.border}
        strokeWidth={0.5}
        vectorEffect="non-scaling-stroke"
        opacity={axisOpacity}
      />
      {/* Pre-dates-history dash */}
      {row.predatesHistory && (
        <line
          x1={dotX - 2}
          y1={AXIS_Y - 6}
          x2={dotX + 2}
          y2={AXIS_Y + 6}
          stroke={row.circleColor}
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
          opacity={dotOpacity}
          strokeLinecap="round"
        />
      )}
      {/* Formation dot */}
      {!row.predatesHistory && (
        <circle
          cx={dotX}
          cy={AXIS_Y}
          r={dotR}
          fill={row.circleColor}
          opacity={dotOpacity}
          style={{ transition: `r ${ENTRY_MS}ms ease, opacity ${ENTRY_MS}ms ease` }}
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}

// ── Single row component ──────────────────────────────────────────────

interface CycleRowProps {
  row: CycleGenesisRow;
  hovered: boolean;
  anyHovered: boolean;
  onHoverEnter: (id: string) => void;
  onHoverLeave: () => void;
  onFocusMember: (memberId: string) => void;
}

function CycleRow({
  row,
  hovered,
  anyHovered,
  onHoverEnter,
  onHoverLeave,
  onFocusMember,
}: CycleRowProps) {
  const allDimmed = anyHovered && !hovered;

  const rowStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "35% 30% 35%",
    alignItems: "center",
    paddingTop: space[1],
    paddingBottom: space[1],
    borderRadius: radius.sm,
    backgroundColor: hovered ? color.hover : "transparent",
    opacity: allDimmed ? 0.4 : 1,
    transition: `opacity ${ENTRY_MS}ms ease, background-color 120ms ease`,
    cursor: "default",
  };

  const handleEnter = useCallback(() => onHoverEnter(row.id), [row.id, onHoverEnter]);

  // Member label — click first member to focus.
  const firstMember = row.sccMembers[0];
  const handleMemberClick = useCallback(() => {
    if (firstMember) onFocusMember(firstMember);
  }, [firstMember, onFocusMember]);

  const memberLabelStyle: CSSProperties = {
    paddingLeft: LABEL_PAD_LEFT,
    fontFamily: font.sans,
    fontSize: font.size.sm,
    fontWeight: font.weight.medium,
    color: hovered ? color.text0 : color.text1,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    cursor: "pointer",
  };

  const rightStyle: CSSProperties = {
    paddingRight: LABEL_PAD_RIGHT,
    textAlign: "right",
  };

  const ageStyle: CSSProperties = {
    fontFamily: font.sans,
    fontSize: font.size.xs,
    fontWeight: font.weight.regular,
    color: color.text2,
    display: "block",
  };

  const edgeStyle: CSSProperties = {
    fontFamily: font.mono,
    fontSize: font.size.xxs,
    color: color.text3,
    display: "block",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    marginTop: 2,
  };

  const shaStyle: CSSProperties = {
    fontFamily: font.mono,
    fontSize: font.size.xxs,
    color: color.text3,
    display: "inline-block",
    marginLeft: space[1],
    opacity: 0.7,
  };

  return (
    <div
      style={rowStyle}
      onPointerEnter={handleEnter}
      onPointerLeave={onHoverLeave}
    >
      {/* Left: member label */}
      <div
        style={memberLabelStyle}
        onClick={handleMemberClick}
        title={row.sccMembers.join(" ↔ ")}
      >
        {row.memberLabel}
        {row.formedAtSha && (
          <span style={shaStyle}>
            {row.formedAtSha.slice(0, 7)}
          </span>
        )}
      </div>

      {/* Centre: timeline SVG strip */}
      <TimelineStrip row={row} hovered={hovered} allDimmed={anyHovered && !hovered} />

      {/* Right: age + introducing edge */}
      <div style={rightStyle}>
        <span style={ageStyle}>{row.ageLabel}</span>
        {row.introducingEdge && (
          <span style={edgeStyle} title={`${row.introducingEdge.from} → ${row.introducingEdge.to}`}>
            {"\u2190"}&nbsp;{shortId(row.introducingEdge.from)}&nbsp;&rarr;&nbsp;{shortId(row.introducingEdge.to)}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Axis header component ─────────────────────────────────────────────

interface AxisHeaderProps {
  earliestTimestamp: number | null;
  nowTimestamp: number;
}

function AxisHeader({ earliestTimestamp, nowTimestamp }: AxisHeaderProps) {
  const fmt = (ts: number) =>
    new Date(ts).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
    });

  const containerStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "35% 30% 35%",
    alignItems: "center",
    paddingBottom: space[1],
    marginBottom: space[1],
    borderBottom: `1px solid ${color.border}`,
  };

  const labelStyle: CSSProperties = {
    fontFamily: font.sans,
    fontSize: font.size.xxs,
    color: color.text3,
    userSelect: "none",
  };

  // Centre strip: left = earliest, right = NOW
  const stripStyle: CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  };

  return (
    <div style={containerStyle}>
      <div style={{ paddingLeft: LABEL_PAD_LEFT, ...labelStyle }}>Cycle</div>
      <div style={stripStyle}>
        <span style={labelStyle}>
          {earliestTimestamp !== null ? fmt(earliestTimestamp) : "..."}
        </span>
        <span style={labelStyle}>{fmt(nowTimestamp)}</span>
      </div>
      <div style={{ paddingRight: LABEL_PAD_RIGHT, textAlign: "right", ...labelStyle }}>
        Age · Edge
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────

function CycleGenesisViewImpl({
  graph,
  onFocusEntity,
  onDismiss,
}: CycleGenesisViewProps) {
  const [mounted, setMounted] = useState(false);
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);

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

  const layout = useMemo(
    () => buildCycleGenesisLayout({ graph }),
    [graph],
  );

  const handleHoverEnter = useCallback((id: string) => setHoveredRowId(id), []);
  const handleHoverLeave = useCallback(() => setHoveredRowId(null), []);

  const handleFocusMember = useCallback(
    (memberId: string) => onFocusEntity?.(memberId),
    [onFocusEntity],
  );

  const rootStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    width: "100%",
    fontFamily: font.sans,
    opacity: mounted ? 1 : 0,
    transition: `opacity ${ENTRY_MS}ms ease-out`,
  };

  // ── Header ─────────────────────────────────────────────────────────

  const headerStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: LABEL_PAD_LEFT,
    paddingRight: LABEL_PAD_RIGHT,
    paddingTop: space[2],
    paddingBottom: space[2],
    borderBottom: `1px solid ${color.border}`,
    flexShrink: 0,
  };

  const titleStyle: CSSProperties = {
    fontFamily: font.sans,
    fontSize: font.size.lg,
    fontWeight: font.weight.semibold,
    color: color.text0,
    letterSpacing: font.letter.tight,
    userSelect: "none",
  };

  const dismissBtnStyle: CSSProperties = {
    border: "none",
    background: "none",
    cursor: "pointer",
    color: color.text2,
    fontSize: font.size.xl,
    lineHeight: 1,
    padding: `${space[1]}px ${space[1]}px`,
    borderRadius: radius.xs,
    display: onDismiss ? "flex" : "none",
    alignItems: "center",
  };

  const countBadgeStyle: CSSProperties = {
    marginLeft: space[2],
    display: "inline-flex",
    alignItems: "center",
    paddingLeft: space[2],
    paddingRight: space[2],
    paddingTop: 2,
    paddingBottom: 2,
    borderRadius: radius.pill,
    backgroundColor: layout.rows.length > 0 ? "rgba(239,68,68,0.10)" : "rgba(34,160,107,0.10)",
    color: layout.rows.length > 0 ? "#ef4444" : "#22a06b",
    fontSize: font.size.xs,
    fontWeight: font.weight.semibold,
    fontFamily: font.sans,
    userSelect: "none",
  };

  // ── Empty state ────────────────────────────────────────────────────

  if (layout.rows.length === 0) {
    const emptyStyle: CSSProperties = {
      ...rootStyle,
    };

    const emptyBodyStyle: CSSProperties = {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: space[7],
      gap: space[3],
    };

    const emptyIconStyle: CSSProperties = {
      width: 40,
      height: 40,
      borderRadius: radius.pill,
      backgroundColor: "rgba(34,160,107,0.12)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 20,
    };

    const emptyTextStyle: CSSProperties = {
      fontFamily: font.sans,
      fontSize: font.size.md,
      fontWeight: font.weight.medium,
      color: "#22a06b",
      textAlign: "center",
    };

    const emptySubStyle: CSSProperties = {
      fontFamily: font.sans,
      fontSize: font.size.sm,
      color: color.text2,
      textAlign: "center",
    };

    const noHistoryStyle: CSSProperties = {
      fontFamily: font.sans,
      fontSize: font.size.sm,
      color: color.text3,
      textAlign: "center",
    };

    return (
      <div style={emptyStyle}>
        <div style={headerStyle}>
          <span style={titleStyle}>
            Cycle Birth Timeline
            <span style={countBadgeStyle}>0 cycles</span>
          </span>
          {onDismiss && (
            <button style={dismissBtnStyle} onClick={onDismiss} aria-label="Dismiss">
              &#x2715;
            </button>
          )}
        </div>
        <div style={emptyBodyStyle}>
          <div style={emptyIconStyle}>&#10003;</div>
          <div style={emptyTextStyle}>No cycles detected</div>
          {!graph.history && (
            <div style={noHistoryStyle}>
              No history available — temporal analysis unavailable.
            </div>
          )}
          {graph.history && (
            <div style={emptySubStyle}>
              No strongly connected components found in the current graph.
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Body ───────────────────────────────────────────────────────────

  const bodyStyle: CSSProperties = {
    overflowY: "auto",
    overflowX: "hidden",
    flex: 1,
    paddingLeft: 0,
    paddingRight: 0,
    paddingTop: space[2],
    paddingBottom: space[2],
  };

  const axisHeaderContainerStyle: CSSProperties = {
    paddingLeft: 0,
    paddingRight: 0,
    paddingTop: space[2],
    paddingBottom: 0,
  };

  return (
    <div style={rootStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <span style={titleStyle}>
          Cycle Birth Timeline
          <span style={countBadgeStyle}>{layout.rows.length} cycle{layout.rows.length !== 1 ? "s" : ""}</span>
        </span>
        {onDismiss && (
          <button style={dismissBtnStyle} onClick={onDismiss} aria-label="Dismiss">
            &#x2715;
          </button>
        )}
      </div>

      {/* Axis column labels */}
      <div style={axisHeaderContainerStyle}>
        <AxisHeader
          earliestTimestamp={layout.earliestTimestamp}
          nowTimestamp={layout.nowTimestamp}
        />
      </div>

      {/* Timeline rows */}
      <div style={bodyStyle} role="list" aria-label="Cycle birth timeline rows">
        {layout.rows.map(row => (
          <div key={row.id} role="listitem">
            <CycleRow
              row={row}
              hovered={hoveredRowId === row.id}
              anyHovered={hoveredRowId !== null}
              onHoverEnter={handleHoverEnter}
              onHoverLeave={handleHoverLeave}
              onFocusMember={handleFocusMember}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export const CycleGenesisView = memo(CycleGenesisViewImpl);
