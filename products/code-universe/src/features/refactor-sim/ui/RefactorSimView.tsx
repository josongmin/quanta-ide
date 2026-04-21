// RefactorSimView — "what-if" refactor impact simulator (SOTA++ redesign)
//
// Layout:
//   • Header: title + subtitle + total-debt chip + dismiss ×
//   • Best Move hero card: green-accented, large delta number, kind badge,
//     confidence %, "Affects N files" chip
//   • Compact list below: rank | kind badge | filename | score bar | delta
//     chip | affects chip | 5-segment confidence meter
//   • Click row → smooth height-transition expanded panel (affected files)
//   • Fade-up entry + per-row stagger
//
// Pure DOM — inline styles only — no className — strict TypeScript.

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
  transition,
  shadow,
} from "../../../shared/ui/tokens";
import type { RefactorSimLayout, RefactorSimRow } from "../model/types";
import type { WorkspaceGraph } from "@quanta/canvas-engine";
import { buildRefactorSimLayout } from "../model/build-refactor-sim-layout";

export interface RefactorSimViewProps {
  graph: WorkspaceGraph;
  onFocusEntity?: (id: string) => void;
  onDismiss?: () => void;
}

// ─── Keyframe injection (once) ──────────────────────────────────────────────

let _stylesInjected = false;
function injectStyles(): void {
  if (_stylesInjected || typeof document === "undefined") return;
  _stylesInjected = true;
  const style = document.createElement("style");
  style.textContent = `
    @keyframes rsv-fadeUp {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes rsv-rowIn {
      from { opacity: 0; transform: translateX(-4px); }
      to   { opacity: 1; transform: translateX(0); }
    }
    @keyframes rsv-aurora {
      0%   { background-position: 0% 50%; }
      50%  { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
  `;
  document.head.appendChild(style);
}

// ─── Kind badge colors ──────────────────────────────────────────────────────

const KIND_BADGE_COLORS: Record<string, string> = {
  "extract-interface": "#3b82f6",   // blue
  "split-file":        "#f97316",   // orange
  "break-cycle":       "#ef4444",   // red
  "invert-dependency": "#8b5cf6",   // purple
  "add-tests":         "#14b8a6",   // teal
  "reduce-fan-in":     "#6366f1",   // indigo
};

function kindBadgeColor(kind: string): string {
  return KIND_BADGE_COLORS[kind] ?? "#757575";
}

// ─── Score bar color ────────────────────────────────────────────────────────

function scoreBarColor(score: number): string {
  const hue = 120 - score * 1.2;
  return `hsl(${hue}deg, 65%, 50%)`;
}

// ─── Kind badge ─────────────────────────────────────────────────────────────

interface KindBadgeProps {
  kind: string;
  size?: "sm" | "md";
}

function KindBadge({ kind, size = "sm" }: KindBadgeProps) {
  const clr = kindBadgeColor(kind);
  const style: CSSProperties = {
    display: "inline-block",
    padding: size === "md" ? "3px 9px" : "2px 6px",
    borderRadius: radius.pill,
    fontSize: size === "md" ? font.size.xs : font.size.xxs,
    fontWeight: font.weight.semibold,
    background: `${clr}1a`,
    color: clr,
    lineHeight: "16px",
    flexShrink: 0,
    letterSpacing: 0.3,
    textTransform: "uppercase",
    whiteSpace: "nowrap",
    border: `1px solid ${clr}33`,
  };
  return <span style={style}>{kind}</span>;
}

// ─── Delta chip ─────────────────────────────────────────────────────────────

interface DeltaChipProps {
  delta: number;
  size?: "sm" | "lg";
}

function DeltaChip({ delta, size = "sm" }: DeltaChipProps) {
  const isImprovement = delta < 0;
  const clr = isImprovement ? "#22c55e" : tokenColor.danger;
  const bg = isImprovement ? "rgba(34,197,94,0.12)" : "rgba(229,72,77,0.12)";
  const arrow = isImprovement ? "↓" : "↑";
  const abs = Math.abs(delta).toFixed(1);

  const style: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 2,
    padding: size === "lg" ? "3px 10px" : "1px 7px",
    borderRadius: radius.pill,
    background: bg,
    color: clr,
    fontSize: size === "lg" ? font.size.md : font.size.xs,
    fontWeight: font.weight.semibold,
    fontVariantNumeric: "tabular-nums",
    flexShrink: 0,
    lineHeight: size === "lg" ? "22px" : "18px",
    border: `1px solid ${clr}33`,
  };
  return (
    <span style={style}>
      {arrow} {abs}
    </span>
  );
}

// ─── Score bar ──────────────────────────────────────────────────────────────

interface ScoreBarProps {
  score: number; // 0..100
  mounted: boolean;
  delayMs?: number;
}

function ScoreBar({ score, mounted, delayMs = 0 }: ScoreBarProps) {
  const trackStyle: CSSProperties = {
    flex: 1,
    height: 6,
    borderRadius: radius.pill,
    background: tokenColor.bg3,
    overflow: "hidden",
    minWidth: 48,
  };
  const fillStyle: CSSProperties = {
    height: "100%",
    width: mounted ? `${score}%` : "0%",
    borderRadius: radius.pill,
    background: scoreBarColor(score),
    transition: `width 600ms ease-out ${delayMs}ms`,
  };
  return (
    <div style={trackStyle} title={`Current score: ${score.toFixed(1)}`}>
      <div style={fillStyle} />
    </div>
  );
}

// ─── Confidence meter (5 segments) ──────────────────────────────────────────

interface ConfidenceMeterProps {
  confidence: number; // 0..1
}

function ConfidenceMeter({ confidence }: ConfidenceMeterProps) {
  const filled = Math.round(confidence * 5);
  const clr =
    confidence >= 0.7
      ? "#22c55e"
      : confidence >= 0.5
        ? tokenColor.warn
        : tokenColor.danger;
  const wrapStyle: CSSProperties = {
    display: "flex",
    gap: 2,
    alignItems: "center",
    flexShrink: 0,
  };
  return (
    <div style={wrapStyle} title={`Confidence: ${Math.round(confidence * 100)}%`}>
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          style={{
            width: 6,
            height: 5,
            borderRadius: 2,
            background: i < filled ? clr : tokenColor.bg3,
            border: `1px solid ${i < filled ? clr + "55" : tokenColor.border}`,
            transition: `background ${transition.fast}`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Affects chip ───────────────────────────────────────────────────────────

interface AffectsChipProps {
  count: number;
}

function AffectsChip({ count }: AffectsChipProps) {
  if (count === 0) return null;
  const style: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    padding: "1px 6px",
    borderRadius: radius.pill,
    background: tokenColor.bg3,
    color: tokenColor.text2,
    fontSize: font.size.xxs,
    flexShrink: 0,
    lineHeight: "16px",
    border: `1px solid ${tokenColor.border}`,
  };
  return (
    <span style={style}>
      Affects {count} file{count !== 1 ? "s" : ""}
    </span>
  );
}

// ─── Expanded panel ──────────────────────────────────────────────────────────

interface ExpandedPanelProps {
  row: RefactorSimRow;
  onFocusEntity?: (id: string) => void;
}

function ExpandedPanel({ row, onFocusEntity }: ExpandedPanelProps) {
  const outerStyle: CSSProperties = {
    overflow: "hidden",
    transition: "max-height 200ms ease, opacity 200ms ease",
    maxHeight: 200,
    opacity: 1,
  };
  const innerStyle: CSSProperties = {
    background: tokenColor.bg2,
    borderTop: `1px solid ${tokenColor.border}`,
    padding: `${space[2]}px ${space[4]}px ${space[2]}px 44px`,
    fontSize: font.size.xs,
    color: tokenColor.text1,
  };
  const headerStyle: CSSProperties = {
    fontWeight: font.weight.semibold,
    color: tokenColor.text0,
    marginBottom: space[1],
    fontSize: font.size.xs,
  };
  const fileRowStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: space[2],
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
      <div style={outerStyle}>
        <div style={innerStyle}>
          <span style={{ fontStyle: "italic", color: tokenColor.text2 }}>
            No individual file deltas projected.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div style={outerStyle}>
      <div style={innerStyle}>
        <div style={headerStyle}>
          Affected files ({row.affectedDetails.length})
        </div>
        {row.affectedDetails.slice(0, 8).map(({ fileId, delta }) => {
          const isImprovement = delta < 0;
          const clr = isImprovement ? "#22c55e" : tokenColor.danger;
          const pillStyle: CSSProperties = {
            display: "inline-flex",
            alignItems: "center",
            padding: "0px 5px",
            borderRadius: radius.pill,
            background: isImprovement ? "rgba(34,197,94,0.10)" : "rgba(229,72,77,0.10)",
            color: clr,
            fontSize: font.size.xxs,
            fontWeight: font.weight.semibold,
            fontVariantNumeric: "tabular-nums",
            flexShrink: 0,
            lineHeight: "16px",
          };
          return (
            <div key={fileId} style={fileRowStyle}>
              <span
                style={fileIdStyle}
                title={fileId}
                onClick={() => onFocusEntity?.(fileId)}
                role={onFocusEntity ? "button" : undefined}
                tabIndex={onFocusEntity ? 0 : undefined}
                onKeyDown={
                  onFocusEntity
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onFocusEntity(fileId);
                        }
                      }
                    : undefined
                }
              >
                {fileId}
              </span>
              <span style={pillStyle}>
                {isImprovement ? "↓" : "↑"} {Math.abs(delta).toFixed(1)}
              </span>
            </div>
          );
        })}
        {row.affectedDetails.length > 8 && (
          <div style={{ color: tokenColor.text2, marginTop: space[1], fontSize: font.size.xxs }}>
            +{row.affectedDetails.length - 8} more files
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Best Move hero card ─────────────────────────────────────────────────────

interface BestMoveCardProps {
  row: RefactorSimRow;
  onFocusEntity?: (id: string) => void;
}

function BestMoveCard({ row, onFocusEntity }: BestMoveCardProps) {
  const [hovered, setHovered] = useState(false);
  const [countedDelta, setCountedDelta] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const target = Math.abs(row.projectedDelta);
    const duration = 800;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setCountedDelta(eased * target);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [row.projectedDelta]);

  // Aurora wrapper style
  const auroraWrapStyle: CSSProperties = {
    margin: `${space[3]}px ${space[4]}px ${space[2]}px`,
    borderRadius: radius.md,
    background: "linear-gradient(135deg, #22c55e, #0d99ff, #8b5cf6, #22c55e)",
    backgroundSize: "300% 300%",
    animation: "rsv-aurora 4s ease infinite",
    padding: 2,
  };

  const cardStyle: CSSProperties = {
    borderRadius: `calc(${radius.md}px - 2px)`,
    background: hovered ? "rgba(34,197,94,0.10)" : "rgba(34,197,94,0.06)",
    padding: `${space[3]}px ${space[4]}px`,
    transition: `background ${transition.fast}`,
    cursor: onFocusEntity ? "pointer" : "default",
    boxShadow: hovered ? "0 2px 8px rgba(34,197,94,0.15)" : shadow.xs,
  };

  const labelStyle: CSSProperties = {
    fontSize: font.size.xxs,
    fontWeight: font.weight.semibold,
    color: "#22c55e",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: space[1],
  };
  const deltaStyle: CSSProperties = {
    fontSize: font.size.xl,
    fontWeight: font.weight.semibold,
    color: "#22c55e",
    fontVariantNumeric: "tabular-nums",
    lineHeight: 1.2,
    marginBottom: 2,
  };
  const subtitleStyle: CSSProperties = {
    fontSize: font.size.sm,
    fontWeight: font.weight.medium,
    color: tokenColor.text0,
    marginBottom: space[2],
  };
  const chipsStyle: CSSProperties = {
    display: "flex",
    gap: space[2],
    flexWrap: "wrap",
    alignItems: "center",
  };
  const pctChipStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    padding: "1px 7px",
    borderRadius: radius.pill,
    background: tokenColor.bg3,
    color: tokenColor.text1,
    fontSize: font.size.xxs,
    fontWeight: font.weight.medium,
    border: `1px solid ${tokenColor.border}`,
  };

  return (
    <div style={auroraWrapStyle}>
      <div
        style={cardStyle}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => onFocusEntity?.(row.fileId)}
        role={onFocusEntity ? "button" : undefined}
        tabIndex={onFocusEntity ? 0 : undefined}
        aria-label={`Best move: ${row.kind} on ${row.fileName}`}
        onKeyDown={
          onFocusEntity
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onFocusEntity(row.fileId);
                }
              }
            : undefined
        }
      >
        <div style={labelStyle}>#1 Recommendation</div>
        <div style={deltaStyle}>
          ↓ {countedDelta.toFixed(1)} debt points
        </div>
        <div style={subtitleStyle}>
          Extract · <span style={{ fontFamily: font.mono }}>{row.fileName}</span>
        </div>
        <div style={chipsStyle}>
          <KindBadge kind={row.kind} size="md" />
          <span style={pctChipStyle}>
            confidence {Math.round(row.confidence * 100)}%
          </span>
          <AffectsChip count={row.affectedCount} />
        </div>
      </div>
    </div>
  );
}

// ─── Compact row ─────────────────────────────────────────────────────────────

interface SimRowProps {
  row: RefactorSimRow;
  staggerMs: number;
  mounted: boolean;
  onFocusEntity?: (id: string) => void;
}

function SimRow({ row, staggerMs, mounted, onFocusEntity }: SimRowProps) {
  const [hovered, setHovered] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleClick = useCallback(() => setExpanded((v) => !v), []);
  const handleDblClick = useCallback(() => {
    onFocusEntity?.(row.fileId);
  }, [onFocusEntity, row.fileId]);

  const containerStyle: CSSProperties = {
    background: hovered || expanded ? tokenColor.hover : "transparent",
    transition: `background ${transition.fast}, border-left-color ${transition.fast}`,
    borderBottom: `1px solid ${tokenColor.borderSoft}`,
    borderLeft: hovered ? "3px solid #0d99ff" : "3px solid transparent",
    animation: `rsv-rowIn 220ms ease both`,
    animationDelay: `${staggerMs}ms`,
  };

  const rowStyle: CSSProperties = {
    padding: `${space[2]}px ${space[4]}px`,
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
    width: 22,
    flexShrink: 0,
    fontFamily: font.mono,
    fontSize: font.size.xs,
    color: tokenColor.text3,
    userSelect: "none",
  };

  const fileNameStyle: CSSProperties = {
    flex: 1,
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
    color: tokenColor.text0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    minWidth: 0,
  };

  const bottomLineStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    minWidth: 0,
    paddingLeft: 28,
  };

  const expandArrowStyle: CSSProperties = {
    fontSize: font.size.xxs,
    color: tokenColor.text3,
    marginLeft: "auto",
    flexShrink: 0,
    transition: `transform ${transition.fast}`,
    transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
  };

  return (
    <div
      style={containerStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
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
        {/* Top line: rank · kind badge · filename · delta chip */}
        <div style={topLineStyle}>
          <span style={rankStyle}>#{row.rank}</span>
          <KindBadge kind={row.kind} />
          <span style={fileNameStyle} title={row.fileId}>
            {row.fileName}
          </span>
          <DeltaChip delta={row.projectedDelta} />
          <span style={expandArrowStyle}>▼</span>
        </div>

        {/* Bottom line: score bar · affects chip · confidence meter */}
        <div style={bottomLineStyle}>
          <ScoreBar score={row.score} mounted={mounted} delayMs={staggerMs} />
          <AffectsChip count={row.affectedCount} />
          <ConfidenceMeter confidence={row.confidence} />
        </div>
      </div>

      {expanded && (
        <ExpandedPanel row={row} onFocusEntity={onFocusEntity} />
      )}
    </div>
  );
}

// ─── Total debt chip ─────────────────────────────────────────────────────────

interface TotalDebtChipProps {
  rows: RefactorSimRow[];
  mounted: boolean;
}

function TotalDebtChip({ rows, mounted }: TotalDebtChipProps) {
  const [countedBefore, setCountedBefore] = useState(0);
  const [countedAfter, setCountedAfter] = useState(0);
  const rafBeforeRef = useRef<number>(0);
  const rafAfterRef = useRef<number>(0);

  // Approximate total before = sum of scores; after = sum of (score + projected delta per-file)
  const totalBefore = rows.reduce((s, r) => s + r.score, 0);
  const totalAfter = rows.reduce((s, r) => s + Math.max(0, r.score + r.projectedDelta), 0);

  useEffect(() => {
    if (!mounted || rows.length === 0) return;
    const duration = 600;
    const startBefore = performance.now();
    const tickBefore = (now: number) => {
      const elapsed = now - startBefore;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setCountedBefore(eased * totalBefore);
      if (t < 1) {
        rafBeforeRef.current = requestAnimationFrame(tickBefore);
      }
    };
    rafBeforeRef.current = requestAnimationFrame(tickBefore);

    // After value with 400ms delay
    const afterTimer = setTimeout(() => {
      const startAfter = performance.now();
      const tickAfter = (now: number) => {
        const elapsed = now - startAfter;
        const t = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        setCountedAfter(eased * totalAfter);
        if (t < 1) {
          rafAfterRef.current = requestAnimationFrame(tickAfter);
        }
      };
      rafAfterRef.current = requestAnimationFrame(tickAfter);
    }, 400);

    return () => {
      cancelAnimationFrame(rafBeforeRef.current);
      cancelAnimationFrame(rafAfterRef.current);
      clearTimeout(afterTimer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, rows.length]);

  if (rows.length === 0) return null;

  const style: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "2px 8px",
    borderRadius: radius.pill,
    background: tokenColor.bg3,
    border: `1px solid ${tokenColor.border}`,
    fontSize: font.size.xxs,
    fontWeight: font.weight.medium,
    color: tokenColor.text1,
    fontVariantNumeric: "tabular-nums",
    flexShrink: 0,
    whiteSpace: "nowrap",
  };
  return (
    <span style={style}>
      Total debt: {countedBefore.toFixed(0)} pts → {countedAfter.toFixed(0)} pts
    </span>
  );
}

// ─── Main view ───────────────────────────────────────────────────────────────

function RefactorSimViewImpl({
  graph,
  onFocusEntity,
  onDismiss,
}: RefactorSimViewProps) {
  const [mounted, setMounted] = useState(false);
  const layoutRef = useRef<RefactorSimLayout | null>(null);

  if (layoutRef.current === null) {
    layoutRef.current = buildRefactorSimLayout({ graph });
  }
  const layout = layoutRef.current;

  useEffect(() => {
    layoutRef.current = buildRefactorSimLayout({ graph });
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

  const rootStyle: CSSProperties = {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    background: tokenColor.bg1,
    overflow: "hidden",
    opacity: mounted ? 1 : 0,
    transform: mounted ? "translateY(0)" : "translateY(6px)",
    transition: `opacity 250ms ease-out, transform 250ms ease-out`,
    fontFamily: font.sans,
    position: "relative",
    animation: mounted ? undefined : undefined,
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
    gap: space[2],
    fontSize: font.size.md,
    color: tokenColor.text2,
    padding: space[4],
    textAlign: "center",
  };

  const emptyHintStyle: CSSProperties = {
    fontSize: font.size.xs,
    color: tokenColor.text3,
  };

  // Rows below hero (skip rank 1 which is shown in hero card)
  const heroRow = layout.rows[0] ?? null;
  const remainingRows = layout.rows.slice(1);

  return (
    <div style={rootStyle} role="region" aria-label="Refactor Simulator">
      {/* Header */}
      <div style={headerStyle}>
        <div style={titleBlockStyle}>
          <span style={titleStyle}>Refactor Simulator</span>
          <span style={headerSubtitleStyle}>
            projected impact of each refactoring plan
          </span>
        </div>
        {layout.rows.length > 0 && (
          <TotalDebtChip rows={layout.rows} mounted={mounted} />
        )}
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

      {/* Body */}
      {layout.rows.length === 0 ? (
        <div style={emptyStyle}>
          <span>No refactor suggestions</span>
          <span style={emptyHintStyle}>
            Graph has no high-ROI refactoring opportunities
          </span>
        </div>
      ) : (
        <div style={scrollAreaStyle}>
          {/* Best Move hero card */}
          {heroRow !== null && (
            <BestMoveCard row={heroRow} onFocusEntity={onFocusEntity} />
          )}

          {/* Section label */}
          {remainingRows.length > 0 && (
            <div
              style={{
                padding: `${space[2]}px ${space[4]}px ${space[1]}px`,
                fontSize: font.size.xxs,
                fontWeight: font.weight.semibold,
                color: tokenColor.text3,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                borderBottom: `1px solid ${tokenColor.border}`,
              }}
            >
              Other Plans
            </div>
          )}

          {/* Remaining rows (staggered) */}
          {remainingRows.map((row, i) => (
            <SimRow
              key={`${row.fileId}:${row.kind}`}
              row={row}
              staggerMs={i * 35}
              mounted={mounted}
              onFocusEntity={onFocusEntity}
            />
          ))}

          <div style={{ height: 12 }} />
        </div>
      )}

      {/* Footer hint */}
      {layout.rows.length > 0 && (
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
          Click to expand · Double-click to focus file on canvas
        </div>
      )}
    </div>
  );
}

export const RefactorSimView = memo(RefactorSimViewImpl);
