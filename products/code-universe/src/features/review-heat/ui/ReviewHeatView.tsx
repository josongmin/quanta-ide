// ReviewHeatView — code-review cycle-time × comment-density scatter.
// --------------------------------------------------------------------
// Left:  SVG scatter. X = review cycle time (hours, log scale).
//        Y = comment count. Bubble radius = PR LoC. "Rework quagmire"
//        quadrant (high X + high Y) is softly shaded red.
// Right: ranked list of slowest PRs — age in hours + reviewer avatars
//        (colored dots from authorHue).
//
// Reference: Baysal et al. MSR 2013.

import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import {
  color as tokenColor,
  font,
  radius as radiusToken,
  space,
} from "../../../shared/ui/tokens";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import {
  authorHue,
  hashId,
  mulberry32,
  reviewCommentCount,
  reviewCycleTime,
} from "../../../shared/analytics/synth-metrics";

export interface ReviewHeatViewProps {
  ctx: ViewContextValue;
}

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 520;
const STAGGER_MS = 16;

const KEYFRAMES = `
@keyframes rhFadeIn {
  from { opacity: 0; transform: scale(0.98); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes rhItemIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
`;

interface HeatPoint {
  id: string;
  name: string;
  path: string;
  cycleHours: number;     // X (log scale)
  comments: number;       // Y
  loc: number;            // bubble size
  reviewers: readonly string[];
}

const REVIEWER_POOL = ["jo", "kim", "park", "lee", "song", "han", "yoon", "choi"] as const;

const MAX_POINTS = 180; // cap for render perf on huge repos

function reviewerList(id: string): string[] {
  const rng = mulberry32(hashId(`${id}:reviewers`));
  const n = 1 + Math.floor(rng() * 3);
  const set = new Set<string>();
  while (set.size < n) {
    const r = REVIEWER_POOL[Math.floor(rng() * REVIEWER_POOL.length)];
    if (r) set.add(r);
  }
  return Array.from(set);
}

function ReviewHeatViewImpl({ ctx }: ReviewHeatViewProps): ReactElement | null {
  const width = Math.max(1, ctx.viewportSize.w);
  const height = Math.max(1, ctx.viewportSize.h);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    let a = 0;
    let b = 0;
    a = requestAnimationFrame(() => {
      b = requestAnimationFrame(() => setMounted(true));
    });
    return () => {
      cancelAnimationFrame(a);
      cancelAnimationFrame(b);
    };
  }, []);

  const points = useMemo<HeatPoint[]>(() => {
    if (!ctx.tree) return [];
    const all: HeatPoint[] = [];
    for (const e of ctx.tree.byId.values()) {
      if (e.kind !== "building") continue;
      all.push({
        id: e.id,
        name: e.name,
        path: e.path,
        cycleHours: reviewCycleTime(e),
        comments: reviewCommentCount(e),
        loc: e.metrics?.loc ?? 100,
        reviewers: reviewerList(e.id),
      });
    }
    // Cap: keep highest comment + cycle-time combos so the quagmire
    // is preserved when we slice.
    all.sort((a, b) => b.cycleHours * (1 + b.comments) - a.cycleHours * (1 + a.comments));
    return all.slice(0, MAX_POINTS);
  }, [ctx.tree]);

  const slowest = useMemo<HeatPoint[]>(() => {
    return [...points].sort((a, b) => b.cycleHours - a.cycleHours).slice(0, 14);
  }, [points]);

  if (!ctx.tree || points.length === 0) {
    return (
      <div
        style={{
          width,
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: tokenColor.text3,
          fontFamily: font.sans,
          fontSize: font.size.md,
          background: tokenColor.bg0,
        }}
      >
        <style>{KEYFRAMES}</style>
        데이터가 아직 없어요
      </div>
    );
  }

  const panelPad = 48;
  const rightW = 300;
  const plotOuterW = Math.max(360, width - panelPad * 2 - rightW - 20);
  const plotOuterH = Math.max(280, height - 220);

  const PAD_LEFT = 58;
  const PAD_RIGHT = 20;
  const PAD_TOP = 18;
  const PAD_BOTTOM = 44;
  const plotX = PAD_LEFT;
  const plotY = PAD_TOP;
  const plotW = Math.max(1, plotOuterW - PAD_LEFT - PAD_RIGHT);
  const plotH = Math.max(1, plotOuterH - PAD_TOP - PAD_BOTTOM);

  // X axis: log10(hours). Clamp hours to >=1 so log is finite.
  const xMin = 1;
  const xMax = Math.max(...points.map(p => p.cycleHours), 2);
  const xMaxLog = Math.log10(Math.max(2, xMax));
  // Y axis: linear 0..maxComments.
  const yMax = Math.max(8, ...points.map(p => p.comments));

  const xForHours = (h: number): number => {
    const v = Math.log10(Math.max(xMin, h)) / xMaxLog;
    return plotX + Math.max(0, Math.min(1, v)) * plotW;
  };
  const yForComments = (c: number): number => {
    const v = c / yMax;
    return plotY + (1 - Math.max(0, Math.min(1, v))) * plotH;
  };

  // Bubble radius: 3..14 scaled by LoC.
  const locMax = Math.max(...points.map(p => p.loc), 100);
  const rForLoc = (loc: number): number => {
    const t = Math.min(1, loc / locMax);
    return 3 + t * 11;
  };

  // Quagmire region — top-right quadrant in log/linear space.
  const quagX0 = xForHours(Math.pow(10, xMaxLog * 0.6));
  const quagY1 = yForComments(yMax * 0.55);

  const sorted = [...points].sort((a, b) => rForLoc(b.loc) - rForLoc(a.loc));

  const rootStyle: CSSProperties = {
    animation: `rhFadeIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
    transformOrigin: "center top",
    padding: `40px ${panelPad}px 32px ${panelPad}px`,
    boxSizing: "border-box",
    height: "100%",
    overflowY: "auto",
  };

  // X axis ticks — powers of 10 up to xMax.
  const xTicks: number[] = [];
  for (let e = 0; Math.pow(10, e) <= xMax * 1.2; e++) xTicks.push(Math.pow(10, e));

  // Y axis ticks — 0, 25, 50, 75, 100% of yMax.
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => Math.round(t * yMax));

  return (
    <div
      style={{
        width,
        height,
        background: tokenColor.bg0,
        fontFamily: font.sans,
        color: tokenColor.text0,
        position: "relative",
      }}
    >
      <style>{KEYFRAMES}</style>
      <div style={rootStyle}>
        {/* Header */}
        <div style={{ marginBottom: space[4] }}>
          <div
            style={{
              fontSize: font.size.xxl,
              fontWeight: font.weight.bold,
              color: tokenColor.text0,
              letterSpacing: font.letter.tight,
            }}
          >
            Review Heat
          </div>
          <div
            style={{
              fontSize: font.size.xs,
              color: tokenColor.text2,
              marginTop: 4,
            }}
          >
            PR cycle time × comment 밀도 — Baysal MSR 2013
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: `${plotOuterW}px ${rightW}px`,
            gap: 20,
            alignItems: "flex-start",
          }}
        >
          {/* Scatter */}
          <div>
            <svg
              ref={svgRef}
              width={plotOuterW}
              height={plotOuterH}
              viewBox={`0 0 ${plotOuterW} ${plotOuterH}`}
              style={{
                display: "block",
                background: tokenColor.bg2,
                borderRadius: radiusToken.md,
                border: `1px solid ${tokenColor.border}`,
                opacity: mounted ? 1 : 0,
                transition: `opacity ${ENTRY_MS}ms ${ENTRY_EASE}`,
              }}
              role="img"
              aria-label="Review cycle-time × comment density scatter"
            >
              {/* Quagmire region */}
              <rect
                x={quagX0}
                y={plotY}
                width={Math.max(0, plotX + plotW - quagX0)}
                height={Math.max(0, quagY1 - plotY)}
                fill="rgba(229, 72, 77, 0.08)"
              />
              <text
                x={plotX + plotW - 8}
                y={plotY + 14}
                textAnchor="end"
                fontSize={font.size.xxs}
                fontStyle="italic"
                fill={tokenColor.danger}
              >
                rework quagmire
              </text>

              {/* Plot frame */}
              <rect
                x={plotX}
                y={plotY}
                width={plotW}
                height={plotH}
                fill="none"
                stroke={tokenColor.border}
                strokeWidth={1}
              />

              {/* Y ticks */}
              {yTicks.map(v => {
                const y = yForComments(v);
                return (
                  <g key={`y-${v}`}>
                    <line
                      x1={plotX - 4}
                      x2={plotX}
                      y1={y}
                      y2={y}
                      stroke={tokenColor.border}
                    />
                    <text
                      x={plotX - 8}
                      y={y + 3}
                      textAnchor="end"
                      fontSize={font.size.xxs}
                      fill={tokenColor.text2}
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {v}
                    </text>
                  </g>
                );
              })}

              {/* X ticks (log) */}
              {xTicks.map(v => {
                const x = xForHours(v);
                const label = v >= 24 ? `${Math.round(v / 24)}d` : `${v}h`;
                return (
                  <g key={`x-${v}`}>
                    <line
                      x1={x}
                      x2={x}
                      y1={plotY + plotH}
                      y2={plotY + plotH + 4}
                      stroke={tokenColor.border}
                    />
                    <text
                      x={x}
                      y={plotY + plotH + 16}
                      textAnchor="middle"
                      fontSize={font.size.xxs}
                      fill={tokenColor.text2}
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {label}
                    </text>
                  </g>
                );
              })}

              {/* Axis labels */}
              <text
                x={plotX + plotW / 2}
                y={plotOuterH - 6}
                textAnchor="middle"
                fontSize={font.size.sm}
                fill={tokenColor.text2}
              >
                Cycle time (hours, log)
              </text>
              <text
                x={0}
                y={0}
                textAnchor="middle"
                fontSize={font.size.sm}
                fill={tokenColor.text2}
                transform={`translate(14, ${plotY + plotH / 2}) rotate(-90)`}
              >
                Comments
              </text>

              {/* Points */}
              {sorted.map((p, i) => {
                const cx = xForHours(p.cycleHours);
                const cy = yForComments(p.comments);
                const rr = rForLoc(p.loc);
                const isHovered = hoveredId === p.id;
                const dimmed = hoveredId !== null && !isHovered;
                const isSelected = ctx.selectedId === p.id;
                const inQuag = cx >= quagX0 && cy <= quagY1;
                const fill = inQuag ? tokenColor.danger : tokenColor.accent;
                const opacity = dimmed ? 0.18 : isHovered ? 1.0 : 0.7;
                return (
                  <g key={p.id}>
                    <circle
                      cx={cx}
                      cy={cy}
                      r={rr}
                      fill={fill}
                      opacity={opacity}
                      stroke={isSelected || isHovered ? tokenColor.text0 : "none"}
                      strokeWidth={isSelected ? 2 : isHovered ? 1.5 : 0}
                      style={{
                        cursor: "pointer",
                        transition: "opacity 180ms ease-out",
                        animation: `rhItemIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
                        animationDelay: `${Math.min(i * 2, 300)}ms`,
                      }}
                      onMouseEnter={() => setHoveredId(p.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      onClick={() => ctx.dispatch.selectEntity(p.id)}
                    >
                      <title>
                        {`${p.name} — ${Math.round(p.cycleHours)}h · ${p.comments} comments · ${p.loc} LoC`}
                      </title>
                    </circle>
                  </g>
                );
              })}
            </svg>
            <div
              style={{
                marginTop: space[2],
                fontSize: font.size.xxs,
                color: tokenColor.text3,
              }}
            >
              bubble ∝ PR LoC · red = rework quagmire · click → selectEntity
            </div>
          </div>

          {/* Slowest PR ranked list */}
          <div
            style={{
              background: tokenColor.bg2,
              border: `1px solid ${tokenColor.border}`,
              borderRadius: radiusToken.md,
              padding: space[3],
              maxHeight: plotOuterH + 40,
              overflowY: "auto",
            }}
          >
            <div
              style={{
                fontSize: font.size.xxs,
                color: tokenColor.text2,
                textTransform: "uppercase",
                letterSpacing: font.letter.ultra,
                marginBottom: space[2],
              }}
            >
              Slowest PRs
            </div>
            {slowest.map((p, i) => {
              const isSelected = ctx.selectedId === p.id;
              const isHovered = hoveredId === p.id;
              const ageLabel =
                p.cycleHours >= 24
                  ? `${Math.round(p.cycleHours / 24)}d`
                  : `${Math.round(p.cycleHours)}h`;
              return (
                <div
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => ctx.dispatch.selectEntity(p.id)}
                  onMouseEnter={() => setHoveredId(p.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto 44px",
                    gap: 8,
                    alignItems: "center",
                    padding: `${space[2]}px ${space[2]}px`,
                    borderRadius: radiusToken.sm,
                    cursor: "pointer",
                    marginBottom: 3,
                    background: isSelected
                      ? tokenColor.selected
                      : isHovered
                        ? tokenColor.hover
                        : "transparent",
                    animation: `rhItemIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
                    animationDelay: `${i * STAGGER_MS}ms`,
                    transition: "background 180ms ease-out",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: font.size.sm,
                        fontWeight: font.weight.medium,
                        color: tokenColor.text0,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {p.name}
                    </div>
                    <div
                      style={{
                        fontSize: font.size.xxs,
                        color: tokenColor.text2,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {p.comments} comments
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 3 }}>
                    {p.reviewers.map(rv => (
                      <div
                        key={rv}
                        title={rv}
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: "50%",
                          background: `hsl(${authorHue(rv)} 65% 52%)`,
                          border: `1px solid ${tokenColor.bg0}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 8,
                          fontWeight: font.weight.bold,
                          color: "#fff",
                          letterSpacing: 0,
                        }}
                      >
                        {rv.charAt(0).toUpperCase()}
                      </div>
                    ))}
                  </div>
                  <div
                    style={{
                      fontSize: font.size.xs,
                      fontWeight: font.weight.semibold,
                      color:
                        p.cycleHours > 96
                          ? tokenColor.danger
                          : p.cycleHours > 48
                            ? tokenColor.warn
                            : tokenColor.text1,
                      fontVariantNumeric: "tabular-nums",
                      textAlign: "right",
                    }}
                  >
                    {ageLabel}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export const ReviewHeatView = memo(ReviewHeatViewImpl);
