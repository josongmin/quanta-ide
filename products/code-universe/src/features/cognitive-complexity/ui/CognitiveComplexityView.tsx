// CognitiveComplexityView — SonarQube-style Cognitive Complexity panel.
// --------------------------------------------------------------------
// Top: aggregate histogram of all files across bucket ranges
// (0-4 / 5-9 / 10-19 / 20-29 / 30+), colour-stepped green→danger.
// Bottom: horizontal ranked bar list of the top-40 files, bar length
// ∝ CogC value, colour follows the same bucket gradient.
//
// CogC differs from cyclomatic by weighting nested control flow and
// callback depth more heavily. Campbell, SonarSource whitepaper 2018.
//
// Purely inline SVG + CSS keyframe animation; no external deps.

import { memo, useMemo, useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import {
  color as tokenColor,
  font,
  radius,
  space,
} from "../../../shared/ui/tokens";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { cognitiveComplexity } from "../../../shared/analytics/synth-metrics";

export interface CognitiveComplexityViewProps {
  ctx: ViewContextValue;
}

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 520;
const STAGGER_MS = 16;

const KEYFRAMES = `
@keyframes cogcFadeIn {
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes cogcBarGrow {
  from { transform: scaleX(0); opacity: 0; }
  to   { transform: scaleX(1); opacity: 1; }
}
`;

// Bucket thresholds mirror Sonar's guidance (5 / 10 / 20 / 30).
interface Bucket {
  id: string;
  label: string;
  min: number;
  max: number;
  color: string;
}
// 5-band Cognitive Complexity ramp. Tokens carry success/warn/danger;
// the two intermediate bands ("ok" and "high") need their own literal
// hues to keep the gradient readable between bands.
const BUCKETS: readonly Bucket[] = [
  { id: "low", label: "0-4", min: 0, max: 4, color: tokenColor.success },
  { id: "ok", label: "5-9", min: 5, max: 9, color: "#7db843" },
  { id: "warn", label: "10-19", min: 10, max: 19, color: tokenColor.warn },
  { id: "high", label: "20-29", min: 20, max: 29, color: "#e06a21" },
  { id: "critical", label: "30+", min: 30, max: Infinity, color: tokenColor.danger },
];

function colourFor(score: number): string {
  for (const b of BUCKETS) {
    if (score >= b.min && score <= b.max) return b.color;
  }
  return BUCKETS[BUCKETS.length - 1]!.color;
}

interface FileRow {
  id: string;
  name: string;
  path: string;
  score: number; // CogC units (0..40)
}

function CognitiveComplexityViewImpl({
  ctx,
}: CognitiveComplexityViewProps): ReactElement | null {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const width = Math.max(1, ctx.viewportSize.w);
  const height = Math.max(1, ctx.viewportSize.h);

  const rows = useMemo<FileRow[]>(() => {
    if (!ctx.tree) return [];
    const out: FileRow[] = [];
    for (const e of ctx.tree.byId.values()) {
      if (e.kind !== "building") continue;
      const score = cognitiveComplexity(e) * 40;
      out.push({ id: e.id, name: e.name, path: e.path, score });
    }
    out.sort((a, b) => b.score - a.score);
    return out;
  }, [ctx.tree]);

  const distribution = useMemo<number[]>(() => {
    const counts = BUCKETS.map(() => 0);
    for (const r of rows) {
      for (let i = 0; i < BUCKETS.length; i++) {
        const b = BUCKETS[i]!;
        if (r.score >= b.min && r.score <= b.max) {
          counts[i] = (counts[i] ?? 0) + 1;
          break;
        }
      }
    }
    return counts;
  }, [rows]);

  if (!ctx.tree || rows.length === 0) {
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
        로딩 중
      </div>
    );
  }

  const topRows = rows.slice(0, 40);
  const maxScore = Math.max(1, ...topRows.map(r => r.score));
  const histogramMax = Math.max(1, ...distribution);
  const totalFiles = rows.length;

  const PAD = 32;
  const HIST_H = 120;
  const HEADER_H = 82;

  const rootStyle: CSSProperties = {
    animation: `cogcFadeIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
    transformOrigin: "center top",
  };

  const rowHeight = 22;
  const barLabelW = 240;
  const barValueW = 64;
  const listWidth = Math.max(200, width - PAD * 2);
  const barTrackX = PAD + barLabelW;
  const barTrackW = Math.max(80, listWidth - barLabelW - barValueW);

  return (
    <div
      style={{
        width,
        height,
        background: tokenColor.bg0,
        boxSizing: "border-box",
        position: "relative",
        overflow: "hidden",
        fontFamily: font.sans,
      }}
    >
      <style>{KEYFRAMES}</style>
      <div
        style={{
          ...rootStyle,
          position: "absolute",
          inset: 0,
          padding: `${PAD}px ${PAD}px ${PAD}px ${PAD}px`,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: space[4],
        }}
      >
        {/* Header */}
        <div style={{ height: HEADER_H, flexShrink: 0 }}>
          <div
            style={{
              color: tokenColor.text0,
              fontSize: font.size.display,
              fontWeight: font.weight.semibold,
              letterSpacing: font.letter.tight,
            }}
          >
            Cognitive Complexity
          </div>
          <div
            style={{
              color: tokenColor.text2,
              fontSize: font.size.xs,
              marginTop: 4,
              fontFamily: font.sans,
            }}
          >
            인지 복잡도 — 읽기 어려운 파일 · SonarSource / Campbell 2018
          </div>
          <div
            style={{
              marginTop: 10,
              display: "flex",
              gap: space[3],
              fontFamily: font.mono,
              fontSize: font.size.xs,
              color: tokenColor.text2,
            }}
          >
            <span>
              {totalFiles} files
            </span>
            <span style={{ color: tokenColor.border }}>·</span>
            <span>
              median{" "}
              <span style={{ color: tokenColor.text0 }}>
                {Math.round(
                  rows[Math.floor(rows.length / 2)]?.score ?? 0,
                )}
              </span>
            </span>
            <span style={{ color: tokenColor.border }}>·</span>
            <span>
              max{" "}
              <span style={{ color: tokenColor.text0 }}>
                {Math.round(rows[0]?.score ?? 0)}
              </span>
            </span>
          </div>
        </div>

        {/* Distribution histogram */}
        <div
          style={{
            flexShrink: 0,
            height: HIST_H,
            display: "flex",
            alignItems: "flex-end",
            gap: space[2],
            padding: `${space[2]}px ${space[3]}px ${space[3]}px ${space[3]}px`,
            background: tokenColor.bg2,
            border: `1px solid ${tokenColor.border}`,
            borderRadius: radius.md,
          }}
        >
          {BUCKETS.map((b, i) => {
            const count = distribution[i] ?? 0;
            const h = (count / histogramMax) * (HIST_H - 48);
            return (
              <div
                key={b.id}
                style={{
                  flex: 1,
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "stretch",
                  justifyContent: "flex-end",
                  gap: 4,
                }}
              >
                <div
                  style={{
                    color: tokenColor.text0,
                    fontSize: font.size.xs,
                    fontFamily: font.mono,
                    textAlign: "center",
                    opacity: count > 0 ? 1 : 0.35,
                  }}
                >
                  {count}
                </div>
                <div
                  style={{
                    height: Math.max(2, h),
                    background: b.color,
                    opacity: 0.85,
                    borderRadius: radius.xs,
                    transformOrigin: "bottom center",
                    animation: `cogcBarGrow ${ENTRY_MS}ms ${ENTRY_EASE} both`,
                    animationDelay: `${80 + i * 40}ms`,
                  }}
                />
                <div
                  style={{
                    color: tokenColor.text2,
                    fontSize: font.size.xxs,
                    fontFamily: font.mono,
                    textAlign: "center",
                    marginTop: 2,
                  }}
                >
                  {b.label}
                </div>
              </div>
            );
          })}
        </div>

        {/* Ranked list */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflow: "auto",
            border: `1px solid ${tokenColor.border}`,
            borderRadius: radius.md,
            background: tokenColor.bg1,
          }}
        >
          <div
            style={{
              padding: `${space[3]}px ${space[4]}px`,
              borderBottom: `1px solid ${tokenColor.border}`,
              fontSize: font.size.xs,
              color: tokenColor.text2,
              fontFamily: font.sans,
              letterSpacing: font.letter.wide,
              textTransform: "uppercase",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>Top-40 · CogC units</span>
            <span style={{ fontFamily: font.mono, textTransform: "none" }}>
              max ≈ {Math.round(maxScore)}
            </span>
          </div>
          <svg
            width="100%"
            height={topRows.length * rowHeight + space[2]}
            viewBox={`0 0 ${listWidth} ${topRows.length * rowHeight + space[2]}`}
            preserveAspectRatio="none"
            style={{ display: "block" }}
            role="img"
            aria-label="Cognitive complexity ranking"
          >
            {topRows.map((r, i) => {
              const y = i * rowHeight + 14;
              const barW = (r.score / 40) * barTrackW;
              const c = colourFor(r.score);
              const isHovered = hoveredId === r.id;
              const isSelected = ctx.selectedId === r.id;
              const dim = hoveredId !== null && !isHovered ? 0.38 : 1;
              return (
                <g
                  key={r.id}
                  style={{
                    cursor: "pointer",
                    opacity: dim,
                    transition: "opacity 180ms ease-out",
                    animation: `cogcFadeIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
                    animationDelay: `${140 + Math.min(i * STAGGER_MS, 700)}ms`,
                  }}
                  onMouseEnter={() => setHoveredId(r.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => ctx.dispatch.selectEntity(r.id)}
                >
                  <rect
                    x={PAD - 8}
                    y={y - 15}
                    width={listWidth - PAD * 2 + 16}
                    height={rowHeight - 2}
                    fill={isSelected ? tokenColor.accentSoft : "transparent"}
                    stroke={isSelected ? tokenColor.accentBorder : "none"}
                    strokeWidth={1}
                    rx={radius.xs}
                  />
                  {/* Filename */}
                  <text
                    x={PAD}
                    y={y}
                    fill={tokenColor.text0}
                    fontSize={font.size.sm}
                    fontFamily={font.sans}
                    fontWeight={
                      isSelected ? font.weight.semibold : font.weight.regular
                    }
                  >
                    {r.name.length > 38 ? `${r.name.slice(0, 37)}…` : r.name}
                  </text>
                  {/* Bar track */}
                  <rect
                    x={barTrackX}
                    y={y - 10}
                    width={barTrackW}
                    height={10}
                    fill={tokenColor.bg3}
                    rx={radius.xs}
                  />
                  {/* Bar fill */}
                  <rect
                    x={barTrackX}
                    y={y - 10}
                    width={Math.max(1, barW)}
                    height={10}
                    fill={c}
                    opacity={0.95}
                    rx={radius.xs}
                    style={{
                      transformOrigin: `${barTrackX}px ${y - 5}px`,
                      animation: `cogcBarGrow ${ENTRY_MS}ms ${ENTRY_EASE} both`,
                      animationDelay: `${180 + Math.min(i * STAGGER_MS, 700)}ms`,
                    }}
                  />
                  {/* Numeric value */}
                  <text
                    x={barTrackX + barTrackW + 10}
                    y={y}
                    fill={tokenColor.text1}
                    fontSize={font.size.xs}
                    fontFamily={font.mono}
                    textAnchor="start"
                  >
                    {r.score.toFixed(1)}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}

export const CognitiveComplexityView = memo(CognitiveComplexityViewImpl);
