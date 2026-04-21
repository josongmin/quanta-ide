// RefactorTerrainView — ranked heatmap answering "What should I fix FIRST?"
//
// Renders a scrollable list of files scored by refactor ROI. Each row shows:
//   - Rank + filename + group label + effort badge + score
//   - A colored score bar (red=high risk, green=low risk)
//   - A stacked component breakdown bar (churn / complexity / fanIn / testDebt / cycleMembership)
//   - An optional suggestion line
//
// Pure DOM (no SVG root) — tabular ranked data maps better to divs than
// coordinate-space SVG. ChordView uses SVG for its radial geometry; here
// the list structure calls for straightforward HTML.

import { memo, useCallback, useEffect, useState, type CSSProperties } from "react";
import { color as tokenColor, font, radius, shadow } from "../../../shared/ui/tokens";
import type { RefactorTerrainLayout, RefactorTerrainRow } from "../model/types";

export interface RefactorTerrainViewProps {
  layout: RefactorTerrainLayout;
  width: number;
  height: number;
  onFocusEntity?: (id: string) => void;
  onDismiss?: () => void;
}

const ENTRY_MS = 280;

// ─── Effort badge ──────────────────────────────────────────────────────────

const EFFORT_COLORS: Record<"low" | "medium" | "high", { bg: string; text: string }> = {
  low: { bg: "rgba(34, 160, 107, 0.12)", text: "#22a06b" },
  medium: { bg: "rgba(224, 147, 33, 0.12)", text: "#e09321" },
  high: { bg: "rgba(229, 72, 77, 0.12)", text: "#e5484d" },
};

interface EffortBadgeProps {
  effort: "low" | "medium" | "high";
}

function EffortBadge({ effort }: EffortBadgeProps) {
  const c = EFFORT_COLORS[effort];
  const style: CSSProperties = {
    display: "inline-block",
    padding: "1px 6px",
    borderRadius: radius.pill,
    fontSize: font.size.xxs,
    fontWeight: font.weight.medium,
    background: c.bg,
    color: c.text,
    lineHeight: "16px",
    flexShrink: 0,
  };
  return <span style={style}>{effort}</span>;
}

// ─── Single row ────────────────────────────────────────────────────────────

interface RowProps {
  row: RefactorTerrainRow;
  componentColors: RefactorTerrainLayout["componentColors"];
  onFocusEntity?: (id: string) => void;
}

function TerrainRow({ row, componentColors, onFocusEntity }: RowProps) {
  const [hovered, setHovered] = useState(false);

  const handleClick = useCallback(() => {
    onFocusEntity?.(row.fileId);
  }, [onFocusEntity, row.fileId]);

  const handleMouseEnter = useCallback(() => setHovered(true), []);
  const handleMouseLeave = useCallback(() => setHovered(false), []);

  const containerStyle: CSSProperties = {
    padding: "8px 16px",
    cursor: "pointer",
    background: hovered ? tokenColor.hover : "transparent",
    transition: "background 120ms ease",
  };

  // Top line
  const topLineStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    marginBottom: 5,
  };

  const rankStyle: CSSProperties = {
    width: 28,
    flexShrink: 0,
    fontFamily: font.mono,
    fontSize: font.size.xs,
    color: tokenColor.text2,
    userSelect: "none",
  };

  const labelStyle: CSSProperties = {
    flex: 1,
    fontSize: font.size.md,
    fontWeight: font.weight.bold,
    color: tokenColor.text0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };

  const groupLabelStyle: CSSProperties = {
    fontSize: font.size.xs,
    color: tokenColor.text2,
    flexShrink: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: 100,
  };

  const scoreStyle: CSSProperties = {
    fontSize: font.size.md,
    fontWeight: font.weight.bold,
    color: tokenColor.text0,
    fontVariantNumeric: "tabular-nums",
    flexShrink: 0,
    marginLeft: 4,
  };

  // Score bar
  const scoreBarTrackStyle: CSSProperties = {
    width: "100%",
    height: 6,
    borderRadius: radius.sm,
    background: tokenColor.bg2,
    overflow: "hidden",
    marginBottom: 3,
  };

  const scoreBarFillStyle: CSSProperties = {
    height: "100%",
    width: `${row.score}%`,
    borderRadius: radius.sm,
    background: row.barColor,
  };

  // Component stacked bar
  const componentBarStyle: CSSProperties = {
    width: "100%",
    height: 4,
    borderRadius: radius.xs,
    overflow: "hidden",
    display: "flex",
    marginBottom: row.suggestion ? 4 : 0,
  };

  const totalComponentScore =
    row.components.churn +
    row.components.complexity +
    row.components.fanIn +
    row.components.testDebt +
    row.components.cycleMembership;
  const componentTotal = totalComponentScore > 0 ? totalComponentScore : 1;

  const componentSegments: { key: keyof typeof row.components; color: string }[] = [
    { key: "churn", color: componentColors.churn },
    { key: "complexity", color: componentColors.complexity },
    { key: "fanIn", color: componentColors.fanIn },
    { key: "testDebt", color: componentColors.testDebt },
    { key: "cycleMembership", color: componentColors.cycleMembership },
  ];

  return (
    <div
      style={containerStyle}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onFocusEntity?.(row.fileId);
        }
      }}
      aria-label={`Rank ${row.rank}: ${row.label}, score ${row.score.toFixed(1)}`}
    >
      {/* Top line */}
      <div style={topLineStyle}>
        <span style={rankStyle}>#{row.rank}</span>
        <span style={labelStyle} title={row.fileId}>{row.label}</span>
        <span style={groupLabelStyle} title={row.groupLabel}>{row.groupLabel}</span>
        {row.effort !== undefined && <EffortBadge effort={row.effort} />}
        <span style={scoreStyle}>{row.score.toFixed(1)}</span>
      </div>

      {/* Score bar */}
      <div style={scoreBarTrackStyle}>
        <div style={scoreBarFillStyle} />
      </div>

      {/* Component breakdown bar */}
      <div style={componentBarStyle}>
        {componentSegments.map(({ key, color }) => {
          const pct = (row.components[key] / componentTotal) * 100;
          if (pct <= 0) return null;
          return (
            <div
              key={key}
              style={{ width: `${pct}%`, background: color, height: "100%" }}
              title={`${key}: ${row.components[key].toFixed(1)}`}
            />
          );
        })}
      </div>

      {/* Suggestion */}
      {row.suggestion !== undefined && (
        <div
          style={{
            fontSize: font.size.xs,
            color: tokenColor.text2,
            fontStyle: "italic",
            marginTop: 2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={row.suggestion}
        >
          {row.suggestion.length > 80
            ? `${row.suggestion.slice(0, 80)}…`
            : row.suggestion}
        </div>
      )}
    </div>
  );
}

// ─── Legend strip ──────────────────────────────────────────────────────────

interface LegendStripProps {
  componentColors: RefactorTerrainLayout["componentColors"];
}

const COMPONENT_LABELS: Record<keyof RefactorTerrainLayout["componentColors"], string> = {
  churn: "churn",
  complexity: "complexity",
  fanIn: "fan-in",
  testDebt: "test debt",
  cycleMembership: "cycles",
};

function LegendStrip({ componentColors }: LegendStripProps) {
  const stripStyle: CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
    padding: "6px 16px",
    borderBottom: `1px solid ${tokenColor.border}`,
    flexShrink: 0,
  };

  const entryStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 5,
  };

  const labelStyle: CSSProperties = {
    fontSize: font.size.xs,
    color: tokenColor.text2,
    lineHeight: 1,
  };

  const keys = Object.keys(componentColors) as Array<keyof typeof componentColors>;

  return (
    <div style={stripStyle}>
      {keys.map((key) => (
        <div key={key} style={entryStyle}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: componentColors[key],
              flexShrink: 0,
            }}
          />
          <span style={labelStyle}>{COMPONENT_LABELS[key]}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main view ─────────────────────────────────────────────────────────────

function RefactorTerrainViewImpl({
  layout,
  width,
  height,
  onFocusEntity,
  onDismiss,
}: RefactorTerrainViewProps) {
  const [mounted, setMounted] = useState(false);

  // Two-rAF fade-in — same pattern as ChordView.
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
    width,
    height,
    display: "flex",
    flexDirection: "column",
    background: tokenColor.bg1,
    overflow: "hidden",
    opacity: mounted ? 1 : 0,
    transition: `opacity ${ENTRY_MS}ms ease-out`,
    fontFamily: font.sans,
    position: "relative",
  };

  // ── Header ────────────────────────────────────────────────────────────
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

  const maxScoreDisplay = layout.maxScore.toFixed(1);
  const subtitle = `${layout.totalFiles} file${layout.totalFiles !== 1 ? "s" : ""} analyzed · max score ${maxScoreDisplay}`;

  // ── Rows (scrollable) ─────────────────────────────────────────────────
  const scrollAreaStyle: CSSProperties = {
    overflowY: "auto",
    flex: 1,
    position: "relative",
  };

  // ── Overflow indicator (sticky bottom) ───────────────────────────────
  const overflowStyle: CSSProperties = {
    padding: "6px 16px",
    fontSize: font.size.xs,
    color: tokenColor.text2,
    borderTop: `1px solid ${tokenColor.border}`,
    background: tokenColor.bg1,
    flexShrink: 0,
    textAlign: "center",
  };

  // ── Empty state ───────────────────────────────────────────────────────
  const emptyStyle: CSSProperties = {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: font.size.md,
    color: tokenColor.text2,
  };

  const hasRows = layout.rows.length > 0;

  return (
    <div
      style={rootStyle}
      role="region"
      aria-label="Refactor Action Terrain"
    >
      {/* Header */}
      <div style={headerStyle}>
        <span style={titleStyle}>Action Terrain</span>
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

      {/* Legend strip */}
      <LegendStrip componentColors={layout.componentColors} />

      {/* Rows or empty state */}
      {hasRows ? (
        <div style={scrollAreaStyle}>
          {layout.rows.map((row) => (
            <TerrainRow
              key={row.fileId}
              row={row}
              componentColors={layout.componentColors}
              onFocusEntity={onFocusEntity}
            />
          ))}
        </div>
      ) : (
        <div style={emptyStyle}>No files analyzed</div>
      )}

      {/* Overflow indicator */}
      {layout.overflow > 0 && (
        <div style={{ ...overflowStyle, boxShadow: shadow.xs }}>
          +{layout.overflow} more files
        </div>
      )}
    </div>
  );
}

export const RefactorTerrainView = memo(RefactorTerrainViewImpl);
