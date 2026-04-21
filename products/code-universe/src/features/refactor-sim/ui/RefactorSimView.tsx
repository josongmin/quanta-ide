// RefactorSimView — "what-if" refactor impact simulator
//
// Each row represents a refactor plan produced by buildRefactorSuggestions.
// For each plan, simulateRefactor was already called during layout; we show:
//   - Plan kind badge (colored)
//   - File name
//   - Score bar (current ROI score, red→green)
//   - Delta indicator (negative delta = improvement, shown as ↓ green)
//   - "Affects N files" chip
//   - Confidence %
//
// Hover a row: expand panel with the list of affected files + their deltas.
// Top banner: "Best move: ..." summary.
// Pure DOM — no SVG root.

import { memo, useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { color as tokenColor, font, radius, shadow } from "../../../shared/ui/tokens";
import type { RefactorSimLayout, RefactorSimRow } from "../model/types";
import type { WorkspaceGraph } from "@quanta/canvas-engine";
import { buildRefactorSimLayout } from "../model/build-refactor-sim-layout";

export interface RefactorSimViewProps {
  graph: WorkspaceGraph;
  onFocusEntity?: (id: string) => void;
  onDismiss?: () => void;
}

const ENTRY_MS = 280;

// ─── Kind badge ────────────────────────────────────────────────────────────

interface KindBadgeProps {
  kind: string;
  color: string;
}

function KindBadge({ kind, color }: KindBadgeProps) {
  const style: CSSProperties = {
    display: "inline-block",
    padding: "2px 7px",
    borderRadius: radius.pill,
    fontSize: font.size.xxs,
    fontWeight: font.weight.semibold,
    background: `${color}1a`, // 10% alpha
    color,
    lineHeight: "16px",
    flexShrink: 0,
    letterSpacing: 0.3,
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  };
  return <span style={style}>{kind}</span>;
}

// ─── Score bar ─────────────────────────────────────────────────────────────

interface ScoreBarProps {
  score: number; // 0..100
}

function scoreBarColor(score: number): string {
  // red at 100, green at 0
  const hue = 120 - score * 1.2;
  return `hsl(${hue}deg, 65%, 50%)`;
}

function ScoreBar({ score }: ScoreBarProps) {
  const trackStyle: CSSProperties = {
    flex: 1,
    height: 6,
    borderRadius: radius.pill,
    background: tokenColor.bg3,
    overflow: "hidden",
    minWidth: 60,
  };
  const fillStyle: CSSProperties = {
    height: "100%",
    width: `${score}%`,
    borderRadius: radius.pill,
    background: scoreBarColor(score),
    transition: "width 400ms ease",
  };
  return (
    <div style={trackStyle} title={`Current score: ${score.toFixed(1)}`}>
      <div style={fillStyle} />
    </div>
  );
}

// ─── Delta indicator ────────────────────────────────────────────────────────

interface DeltaChipProps {
  delta: number;
}

function DeltaChip({ delta }: DeltaChipProps) {
  const isImprovement = delta < 0;
  const clr = isImprovement ? tokenColor.success : tokenColor.danger;
  const arrow = isImprovement ? "↓" : "↑";
  const label = `${arrow} ${Math.abs(delta).toFixed(1)}`;

  const style: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 2,
    padding: "1px 7px",
    borderRadius: radius.pill,
    background: isImprovement ? "rgba(34, 160, 107, 0.10)" : "rgba(229, 72, 77, 0.10)",
    color: clr,
    fontSize: font.size.xs,
    fontWeight: font.weight.semibold,
    fontVariantNumeric: "tabular-nums",
    flexShrink: 0,
    lineHeight: "18px",
  };
  return <span style={style}>{label}</span>;
}

// ─── Expanded detail panel ──────────────────────────────────────────────────

interface ExpandedPanelProps {
  row: RefactorSimRow;
  onFocusEntity?: (id: string) => void;
}

function ExpandedPanel({ row, onFocusEntity }: ExpandedPanelProps) {
  const containerStyle: CSSProperties = {
    background: tokenColor.bg2,
    borderTop: `1px solid ${tokenColor.border}`,
    padding: "8px 16px 8px 44px",
    fontSize: font.size.xs,
    color: tokenColor.text1,
  };

  const rationaleStyle: CSSProperties = {
    fontStyle: "italic",
    color: tokenColor.text2,
    marginBottom: 6,
  };

  const headerStyle: CSSProperties = {
    fontWeight: font.weight.semibold,
    color: tokenColor.text0,
    marginBottom: 4,
    fontSize: font.size.xs,
  };

  const fileRowStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "2px 0",
  };

  const fileIdStyle: CSSProperties = {
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontFamily: font.mono,
    fontSize: font.size.xxs,
    color: tokenColor.text1,
    cursor: onFocusEntity ? "pointer" : "default",
  };

  if (row.affectedDetails.length === 0) {
    return (
      <div style={containerStyle}>
        <span style={rationaleStyle}>No individual file deltas projected.</span>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {row.affectedDetails.length > 0 && (
        <>
          <div style={headerStyle}>Affected files ({row.affectedDetails.length})</div>
          {row.affectedDetails.slice(0, 8).map(({ fileId, delta }) => {
            const isImprovement = delta < 0;
            const clr = isImprovement ? tokenColor.success : tokenColor.danger;
            return (
              <div key={fileId} style={fileRowStyle}>
                <span
                  style={{ ...fileIdStyle }}
                  title={fileId}
                  onClick={() => onFocusEntity?.(fileId)}
                  role={onFocusEntity ? "button" : undefined}
                  tabIndex={onFocusEntity ? 0 : undefined}
                  onKeyDown={onFocusEntity ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onFocusEntity(fileId);
                    }
                  } : undefined}
                >
                  {fileId}
                </span>
                <span style={{ color: clr, fontVariantNumeric: "tabular-nums", fontWeight: font.weight.medium, fontSize: font.size.xxs, flexShrink: 0 }}>
                  {isImprovement ? "↓" : "↑"} {Math.abs(delta).toFixed(1)}
                </span>
              </div>
            );
          })}
          {row.affectedDetails.length > 8 && (
            <div style={{ color: tokenColor.text2, marginTop: 2 }}>
              +{row.affectedDetails.length - 8} more
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Single row ─────────────────────────────────────────────────────────────

interface SimRowProps {
  row: RefactorSimRow;
  onFocusEntity?: (id: string) => void;
}

function SimRow({ row, onFocusEntity }: SimRowProps) {
  const [hovered, setHovered] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleClick = useCallback(() => {
    setExpanded((v) => !v);
  }, []);

  const handleDblClick = useCallback(() => {
    onFocusEntity?.(row.fileId);
  }, [onFocusEntity, row.fileId]);

  const handleMouseEnter = useCallback(() => setHovered(true), []);
  const handleMouseLeave = useCallback(() => setHovered(false), []);

  const containerStyle: CSSProperties = {
    background: hovered || expanded ? tokenColor.hover : "transparent",
    transition: "background 120ms ease",
    borderBottom: `1px solid ${tokenColor.borderSoft}`,
  };

  const rowStyle: CSSProperties = {
    padding: "8px 16px",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    gap: 5,
  };

  const topLineStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
  };

  const rankStyle: CSSProperties = {
    width: 24,
    flexShrink: 0,
    fontFamily: font.mono,
    fontSize: font.size.xs,
    color: tokenColor.text3,
    userSelect: "none",
  };

  const fileNameStyle: CSSProperties = {
    flex: 1,
    fontSize: font.size.md,
    fontWeight: font.weight.bold,
    color: tokenColor.text0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    minWidth: 0,
  };

  const confidenceStyle: CSSProperties = {
    fontSize: font.size.xs,
    color: tokenColor.text2,
    flexShrink: 0,
    fontVariantNumeric: "tabular-nums",
  };

  const bottomLineStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
  };

  const affectsStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    padding: "1px 6px",
    borderRadius: radius.pill,
    background: tokenColor.bg3,
    color: tokenColor.text2,
    fontSize: font.size.xxs,
    flexShrink: 0,
    lineHeight: "16px",
  };

  const expandHintStyle: CSSProperties = {
    fontSize: font.size.xxs,
    color: tokenColor.text3,
    marginLeft: "auto",
  };

  return (
    <div
      style={containerStyle}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      aria-label={`Rank ${row.rank}: ${row.kind} on ${row.fileName}, delta ${row.projectedDelta.toFixed(1)}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <div style={rowStyle} onClick={handleClick} onDoubleClick={handleDblClick}>
        {/* Top line: rank · kind badge · filename · confidence · delta */}
        <div style={topLineStyle}>
          <span style={rankStyle}>#{row.rank}</span>
          <KindBadge kind={row.kind} color={row.barColor} />
          <span style={fileNameStyle} title={row.fileId}>{row.fileName}</span>
          <span style={confidenceStyle}>{Math.round(row.confidence * 100)}%</span>
          <DeltaChip delta={row.projectedDelta} />
        </div>

        {/* Bottom line: score bar · affects chip · expand hint */}
        <div style={bottomLineStyle}>
          <ScoreBar score={row.score} />
          {row.affectedCount > 0 && (
            <span style={affectsStyle}>
              Affects {row.affectedCount} file{row.affectedCount !== 1 ? "s" : ""}
            </span>
          )}
          <span style={expandHintStyle}>{expanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {expanded && (
        <ExpandedPanel row={row} onFocusEntity={onFocusEntity} />
      )}
    </div>
  );
}

// ─── Best-move banner ───────────────────────────────────────────────────────

interface BestMoveBannerProps {
  summary: string;
}

function BestMoveBanner({ summary }: BestMoveBannerProps) {
  const style: CSSProperties = {
    padding: "8px 16px",
    background: "rgba(13, 153, 255, 0.06)",
    borderBottom: `1px solid ${tokenColor.accentBorder}`,
    fontSize: font.size.xs,
    color: tokenColor.text1,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    gap: 6,
  };
  const iconStyle: CSSProperties = {
    fontSize: font.size.md,
    color: tokenColor.accent,
    flexShrink: 0,
    lineHeight: 1,
  };
  return (
    <div style={style}>
      <span style={iconStyle}>★</span>
      <span>{summary}</span>
    </div>
  );
}

// ─── Main view ──────────────────────────────────────────────────────────────

function RefactorSimViewImpl({
  graph,
  onFocusEntity,
  onDismiss,
}: RefactorSimViewProps) {
  const [mounted, setMounted] = useState(false);
  const layoutRef = useRef<RefactorSimLayout | null>(null);

  // Compute layout once on mount / graph change
  if (layoutRef.current === null) {
    layoutRef.current = buildRefactorSimLayout({ graph });
  }
  const layout = layoutRef.current;

  useEffect(() => {
    layoutRef.current = buildRefactorSimLayout({ graph });
  }, [graph]);

  // Two-rAF fade-in — same pattern as RefactorTerrainView
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

  const scrollAreaStyle: CSSProperties = {
    overflowY: "auto",
    flex: 1,
  };

  const emptyStyle: CSSProperties = {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    fontSize: font.size.md,
    color: tokenColor.text2,
  };

  const emptyHintStyle: CSSProperties = {
    fontSize: font.size.xs,
    color: tokenColor.text3,
  };

  const subtitle = `${layout.totalFiles} file${layout.totalFiles !== 1 ? "s" : ""} · ${layout.rows.length} plan${layout.rows.length !== 1 ? "s" : ""} projected`;

  return (
    <div
      style={rootStyle}
      role="region"
      aria-label="Refactor Simulator"
    >
      {/* Header */}
      <div style={headerStyle}>
        <span style={titleStyle}>Refactor Simulator</span>
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

      {/* Best-move banner */}
      {layout.bestMoveSummary !== null && (
        <BestMoveBanner summary={layout.bestMoveSummary} />
      )}

      {/* Rows or empty state */}
      {layout.rows.length > 0 ? (
        <div style={scrollAreaStyle}>
          {layout.rows.map((row) => (
            <SimRow
              key={`${row.fileId}:${row.kind}`}
              row={row}
              onFocusEntity={onFocusEntity}
            />
          ))}
          {/* Bottom padding so last row isn't flush */}
          <div style={{ height: 12 }} />
        </div>
      ) : (
        <div style={emptyStyle}>
          <span>No refactor suggestions</span>
          <span style={emptyHintStyle}>
            {layout.totalFiles === 0
              ? "Load a workspace with files to analyze."
              : "All files are within healthy thresholds."}
          </span>
        </div>
      )}

      {/* Legend footer */}
      {layout.rows.length > 0 && (
        <div
          style={{
            padding: "5px 16px",
            borderTop: `1px solid ${tokenColor.border}`,
            fontSize: font.size.xxs,
            color: tokenColor.text3,
            flexShrink: 0,
            boxShadow: shadow.xs,
            background: tokenColor.bg1,
          }}
        >
          Click a row to expand · Double-click to focus file on canvas
        </div>
      )}
    </div>
  );
}

export const RefactorSimView = memo(RefactorSimViewImpl);
