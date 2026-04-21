// SmellHistoryView — "Smell History" visualization
// --------------------------------------------------------------------
// SOTA++ DOM-based visualization showing when code smells first appeared.
//
// Layout (top → bottom):
//   1. Header bar — title + dismiss button
//   2. Sparkline strip — SVG sparkline showing smell count over time
//   3. Section groups — one per SmellKind, with colour-coded header
//   4. Entries — dot + file name + age + timestamp chip
//   5. Empty state per section when no smells of that kind
//
// All layouts are DOM (no SVG except for the sparkline strip).
// Hover: hovering an entry highlights it and shows the SHA chip.
// Click: clicking a file name calls onFocusEntity.

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { color, font, radius, space } from "../../../shared/ui/tokens";
import type { WorkspaceGraph } from "@quanta/canvas-engine";
import type { SmellKind } from "@quanta/canvas-engine";
import { buildSmellHistoryLayout, SMELL_COLORS } from "../model/build-smell-history-layout";
import type { SmellHistoryEntry, SparklineBucket } from "../model/types";

// ── Constants ─────────────────────────────────────────────────────────

const ENTRY_MS = 240;
const SPARKLINE_H = 48;
const DOT_SIZE = 7;

// ── Smell section metadata ────────────────────────────────────────────

interface SmellSectionMeta {
  kind: SmellKind;
  label: string;
  description: string;
}

const SMELL_SECTIONS: readonly SmellSectionMeta[] = [
  {
    kind: "high-coupling",
    label: "High Coupling",
    description: "Files with too many dependencies",
  },
  {
    kind: "cycle-member",
    label: "Cycle Member",
    description: "Files participating in import cycles",
  },
  {
    kind: "risk-spike",
    label: "Risk Spike",
    description: "Files whose risk score jumped significantly",
  },
  {
    kind: "layer-violation",
    label: "Layer Violation",
    description: "Files that break architectural layer rules",
  },
];

// ── Prop types ────────────────────────────────────────────────────────

export interface SmellHistoryViewProps {
  graph: WorkspaceGraph;
  onFocusEntity?: (id: string) => void;
  onDismiss?: () => void;
}

// ── Sparkline component ───────────────────────────────────────────────

interface SparklineProps {
  buckets: SparklineBucket[];
}

function Sparkline({ buckets }: SparklineProps) {
  if (buckets.length === 0) return null;

  const maxCount = Math.max(...buckets.map(b => b.count), 1);
  const W = 100; // viewBox units wide
  const H = SPARKLINE_H;
  const padX = 2;
  const padY = 4;
  const usableW = W - padX * 2;
  const usableH = H - padY * 2;

  const pts = buckets.map((b, i) => {
    const x = padX + (i / (buckets.length - 1 || 1)) * usableW;
    const y = padY + usableH - (b.count / maxCount) * usableH;
    return { x, y, count: b.count };
  });

  // Build SVG polyline points string.
  const polyPoints = pts.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");

  // Area path — closed polygon for the fill.
  const areaPath =
    `M ${pts[0].x.toFixed(2)},${H} ` +
    pts.map(p => `L ${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ") +
    ` L ${pts[pts.length - 1].x.toFixed(2)},${H} Z`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      width="100%"
      height={H}
      style={{ display: "block" }}
      aria-label="Smell count over time"
      role="img"
    >
      {/* Area fill */}
      <path d={areaPath} fill="rgba(239,68,68,0.08)" />
      {/* Line */}
      <polyline
        points={polyPoints}
        fill="none"
        stroke="#ef4444"
        strokeWidth={1}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        opacity={0.7}
      />
      {/* Dots at each bucket */}
      {pts.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={1.5}
          fill="#ef4444"
          opacity={0.6}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {/* Zero baseline */}
      <line
        x1={padX}
        y1={H - padY / 2}
        x2={W - padX}
        y2={H - padY / 2}
        stroke={color.border}
        strokeWidth={0.5}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

// ── Single entry row ──────────────────────────────────────────────────

interface EntryRowProps {
  entry: SmellHistoryEntry;
  hovered: boolean;
  onHoverEnter: (id: string) => void;
  onHoverLeave: () => void;
  onFocus: (fileId: string) => void;
}

function EntryRow({
  entry,
  hovered,
  onHoverEnter,
  onHoverLeave,
  onFocus,
}: EntryRowProps) {
  const handleEnter = useCallback(() => onHoverEnter(entry.id), [entry.id, onHoverEnter]);
  const handleClick = useCallback(() => onFocus(entry.fileId), [entry.fileId, onFocus]);

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
    transition: `background-color 120ms ease`,
    cursor: "pointer",
  };

  const dotStyle: CSSProperties = {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: radius.pill,
    backgroundColor: entry.color,
    flexShrink: 0,
  };

  const fileNameStyle: CSSProperties = {
    fontFamily: font.mono,
    fontSize: font.size.sm,
    fontWeight: font.weight.medium,
    color: hovered ? color.text0 : color.text1,
    flex: 1,
    minWidth: 0,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };

  const ageStyle: CSSProperties = {
    fontFamily: font.sans,
    fontSize: font.size.xs,
    color: color.text2,
    whiteSpace: "nowrap",
    flexShrink: 0,
  };

  const shaStyle: CSSProperties = {
    fontFamily: font.mono,
    fontSize: font.size.xxs,
    color: color.text3,
    backgroundColor: color.bg3,
    borderRadius: radius.xs,
    paddingLeft: 4,
    paddingRight: 4,
    paddingTop: 1,
    paddingBottom: 1,
    flexShrink: 0,
    opacity: hovered ? 1 : 0,
    transition: `opacity 120ms ease`,
    userSelect: "text",
  };

  return (
    <div
      style={rowStyle}
      onPointerEnter={handleEnter}
      onPointerLeave={onHoverLeave}
      onClick={handleClick}
      title={entry.fileId}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") handleClick(); }}
    >
      <div style={dotStyle} />
      <span style={fileNameStyle}>{entry.fileName}</span>
      <span style={ageStyle}>{entry.age}</span>
      <span style={shaStyle}>{entry.firstSeenSha.slice(0, 7)}</span>
    </div>
  );
}

// ── Section header + entries ──────────────────────────────────────────

interface SmellSectionProps {
  meta: SmellSectionMeta;
  entries: SmellHistoryEntry[];
  hoveredId: string | null;
  onHoverEnter: (id: string) => void;
  onHoverLeave: () => void;
  onFocus: (fileId: string) => void;
}

function SmellSection({
  meta,
  entries,
  hoveredId,
  onHoverEnter,
  onHoverLeave,
  onFocus,
}: SmellSectionProps) {
  const sectionColor = SMELL_COLORS[meta.kind];

  const headerStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: space[2],
    paddingLeft: space[3],
    paddingRight: space[3],
    paddingTop: space[3],
    paddingBottom: space[2],
  };

  const kindDotStyle: CSSProperties = {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: sectionColor,
    flexShrink: 0,
  };

  const kindLabelStyle: CSSProperties = {
    fontFamily: font.sans,
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
    color: sectionColor,
    letterSpacing: font.letter.tight,
    userSelect: "none",
  };

  const kindDescStyle: CSSProperties = {
    fontFamily: font.sans,
    fontSize: font.size.xs,
    color: color.text3,
    marginLeft: "auto",
    userSelect: "none",
  };

  const countChipStyle: CSSProperties = {
    fontFamily: font.sans,
    fontSize: font.size.xxs,
    fontWeight: font.weight.semibold,
    color: sectionColor,
    backgroundColor: hexToAlpha(sectionColor, 0.1),
    borderRadius: radius.pill,
    paddingLeft: space[2],
    paddingRight: space[2],
    paddingTop: 2,
    paddingBottom: 2,
    flexShrink: 0,
    userSelect: "none",
  };

  const emptyStyle: CSSProperties = {
    paddingLeft: space[3],
    paddingRight: space[3],
    paddingTop: space[2],
    paddingBottom: space[3],
    fontFamily: font.sans,
    fontSize: font.size.xs,
    color: color.text3,
    fontStyle: "italic",
  };

  const separatorStyle: CSSProperties = {
    height: 1,
    backgroundColor: color.border,
    marginLeft: space[3],
    marginRight: space[3],
    marginTop: space[2],
  };

  return (
    <section aria-label={`${meta.label} smells`}>
      <div style={headerStyle}>
        <div style={kindDotStyle} />
        <span style={kindLabelStyle}>{meta.label}</span>
        {entries.length > 0 && (
          <span style={countChipStyle}>{entries.length}</span>
        )}
        <span style={kindDescStyle}>{meta.description}</span>
      </div>

      {entries.length === 0 ? (
        <div style={emptyStyle}>No {meta.label.toLowerCase()} smells found</div>
      ) : (
        entries.map(entry => (
          <EntryRow
            key={entry.id}
            entry={entry}
            hovered={hoveredId === entry.id}
            onHoverEnter={onHoverEnter}
            onHoverLeave={onHoverLeave}
            onFocus={onFocus}
          />
        ))
      )}

      <div style={separatorStyle} />
    </section>
  );
}

// ── Utility: convert hex colour to rgba string ────────────────────────

function hexToAlpha(hex: string, alpha: number): string {
  // Accepts #rrggbb format only (all our SMELL_COLORS are this form).
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ── Sparkline header strip ────────────────────────────────────────────

interface SparklineHeaderProps {
  buckets: SparklineBucket[];
  totalEntries: number;
}

function SparklineHeader({ buckets, totalEntries }: SparklineHeaderProps) {
  const containerStyle: CSSProperties = {
    paddingLeft: space[3],
    paddingRight: space[3],
    paddingTop: space[2],
    paddingBottom: space[1],
    borderBottom: `1px solid ${color.border}`,
  };

  const labelRowStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  };

  const labelStyle: CSSProperties = {
    fontFamily: font.sans,
    fontSize: font.size.xs,
    color: color.text2,
    userSelect: "none",
  };

  const countStyle: CSSProperties = {
    fontFamily: font.sans,
    fontSize: font.size.xs,
    fontWeight: font.weight.semibold,
    color: totalEntries > 0 ? "#ef4444" : color.text2,
    userSelect: "none",
  };

  return (
    <div style={containerStyle}>
      <div style={labelRowStyle}>
        <span style={labelStyle}>Smell count over time</span>
        <span style={countStyle}>{totalEntries} smell{totalEntries !== 1 ? "s" : ""} total</span>
      </div>
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
  const [mounted, setMounted] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

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
    () => buildSmellHistoryLayout({ graph }),
    [graph],
  );

  const handleHoverEnter = useCallback((id: string) => setHoveredId(id), []);
  const handleHoverLeave = useCallback(() => setHoveredId(null), []);
  const handleFocus = useCallback(
    (fileId: string) => onFocusEntity?.(fileId),
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
    paddingLeft: space[3],
    paddingRight: space[3],
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

  // ── No history guard ───────────────────────────────────────────────

  if (!graph.history) {
    const emptyBodyStyle: CSSProperties = {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: space[7],
      gap: space[3],
    };

    const noHistoryStyle: CSSProperties = {
      fontFamily: font.sans,
      fontSize: font.size.sm,
      color: color.text3,
      textAlign: "center",
    };

    return (
      <div style={rootStyle}>
        <div style={headerStyle}>
          <span style={titleStyle}>Smell History</span>
          {onDismiss && (
            <button style={dismissBtnStyle} onClick={onDismiss} aria-label="Dismiss">
              &#x2715;
            </button>
          )}
        </div>
        <div style={emptyBodyStyle}>
          <div style={noHistoryStyle}>
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
  };

  return (
    <div style={rootStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <span style={titleStyle}>Smell History</span>
        {onDismiss && (
          <button style={dismissBtnStyle} onClick={onDismiss} aria-label="Dismiss">
            &#x2715;
          </button>
        )}
      </div>

      {/* Sparkline strip */}
      <SparklineHeader
        buckets={layout.sparkline}
        totalEntries={layout.entries.length}
      />

      {/* Grouped sections */}
      <div style={bodyStyle} role="list" aria-label="Smell history sections">
        {SMELL_SECTIONS.map(meta => (
          <SmellSection
            key={meta.kind}
            meta={meta}
            entries={layout.byKind.get(meta.kind) ?? []}
            hoveredId={hoveredId}
            onHoverEnter={handleHoverEnter}
            onHoverLeave={handleHoverLeave}
            onFocus={handleFocus}
          />
        ))}
      </div>
    </div>
  );
}

export const SmellHistoryView = memo(SmellHistoryViewImpl);
