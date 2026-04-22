// XRayHotspotView — per-function hotspot breakdown inside a single file.
// --------------------------------------------------------------------
// CodeScene X-Ray drill: once you've picked a hot FILE (via the outer
// Hotspot chart, or any selection path), this view decomposes that
// file's heat into its individual FUNCTIONS. It answers "yes the file
// is hot, but WHERE inside it — which specific function should I pry
// open first?"
//
// Reference: Adam Tornhill, "Your Code as a Crime Scene" (2015);
// CodeScene X-Ray feature (empear → codescene.io).
//
// Layout:
//   ── hero: file name + overall file hotspot rating ──
//   ── per-function heat bar chart (sorted desc) ──
//   ── flat row list: name · visibility · LoC · cog-cx · churn · commits
//      · hotness meter (gradient success → warn → danger) ──

import { memo, useMemo, useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import type { Entity } from "@quanta/canvas-engine";
import {
  color as tokenColor,
  font,
  radius as radiusToken,
  space,
} from "../../../shared/ui/tokens";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import {
  churn,
  xRayHotspots,
  type SynthSymbol,
  type XRayFunction,
} from "../../../shared/analytics/synth-metrics";

export interface XRayHotspotViewProps {
  ctx?: ViewContextValue;
  entity?: Entity;
  empty?: boolean;
}

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 520;
const STAGGER_MS = 16;

const KEYFRAMES = `
@keyframes xrFadeIn {
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes xrItemIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes xrBarGrow {
  from { width: 0%; }
  to   { width: var(--xr-bar-target); }
}
`;

const VIS_STYLE: Record<SynthSymbol["visibility"], { bg: string; fg: string; label: string }> = {
  public:   { bg: "#d1fae5", fg: "#065f46", label: "public"   },
  internal: { bg: "#e0e7ff", fg: "#3730a3", label: "internal" },
  private:  { bg: "#fee2e2", fg: "#991b1b", label: "private"  },
};

/** Gradient fill from success → warn → danger based on hotness [0..1]. */
function hotnessGradient(h: number): string {
  // Map the fill to a 3-stop gradient per-row, anchored at the start.
  if (h >= 0.7) {
    return `linear-gradient(90deg, ${tokenColor.warn} 0%, ${tokenColor.danger} 100%)`;
  }
  if (h >= 0.4) {
    return `linear-gradient(90deg, ${tokenColor.success} 0%, ${tokenColor.warn} 100%)`;
  }
  return `linear-gradient(90deg, ${tokenColor.success} 0%, ${tokenColor.success} 100%)`;
}

function hotnessSolid(h: number): string {
  if (h >= 0.7) return tokenColor.danger;
  if (h >= 0.4) return tokenColor.warn;
  return tokenColor.success;
}

/** Overall file rating letter + label from aggregate hotness. */
function fileRating(avg: number, peak: number): { label: string; color: string } {
  const s = avg * 0.6 + peak * 0.4;
  if (s >= 0.7) return { label: "CRITICAL HOTSPOT", color: tokenColor.danger };
  if (s >= 0.5) return { label: "HOT",              color: tokenColor.warn };
  if (s >= 0.3) return { label: "WARM",             color: tokenColor.accent };
  return { label: "COOL", color: tokenColor.success };
}

function XRayHotspotViewImpl({ ctx, entity, empty }: XRayHotspotViewProps): ReactElement {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const width = Math.max(1, ctx?.viewportSize.w ?? 1);
  const height = Math.max(1, ctx?.viewportSize.h ?? 1);

  const rows = useMemo<XRayFunction[]>(() => {
    if (!entity) return [];
    return xRayHotspots(entity);
  }, [entity]);

  const fileCh = useMemo(() => (entity ? churn(entity) : 0), [entity]);
  const stats = useMemo(() => {
    if (rows.length === 0) return { avg: 0, peak: 0 };
    let sum = 0;
    let peak = 0;
    for (const r of rows) {
      sum += r.hotness;
      if (r.hotness > peak) peak = r.hotness;
    }
    return { avg: sum / rows.length, peak };
  }, [rows]);

  // ── Empty state ──
  if (empty || !entity || rows.length === 0) {
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
          textAlign: "center",
          padding: space[5],
          boxSizing: "border-box",
        }}
      >
        <style>{KEYFRAMES}</style>
        <div style={{ animation: `xrFadeIn ${ENTRY_MS}ms ${ENTRY_EASE} both` }}>
          <div
            style={{
              fontSize: 40,
              marginBottom: space[2],
              color: tokenColor.text3,
            }}
            aria-hidden
          >
            ◉
          </div>
          <div>파일을 선택하면 X-Ray 뷰가 나타납니다.</div>
          <div
            style={{
              fontSize: font.size.xxs,
              color: tokenColor.text3,
              marginTop: space[1],
            }}
          >
            CodeScene X-Ray — function-level hotspot drill
          </div>
        </div>
      </div>
    );
  }

  const rating = fileRating(stats.avg, stats.peak);
  const maxHot = Math.max(0.0001, rows[0]?.hotness ?? 0);

  const rootStyle: CSSProperties = {
    animation: `xrFadeIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
    transformOrigin: "center top",
    padding: "40px 48px 32px 48px",
    boxSizing: "border-box",
    height: "100%",
    overflowY: "auto",
  };

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
        <div style={{ marginBottom: space[3] }}>
          <div
            style={{
              fontSize: font.size.xxl,
              fontWeight: font.weight.bold,
              color: tokenColor.text0,
              letterSpacing: font.letter.tight,
            }}
          >
            X-Ray
          </div>
          <div
            style={{
              fontSize: font.size.xs,
              color: tokenColor.text2,
              marginTop: 4,
            }}
          >
            파일 내부 함수별 핫스팟 — Tornhill, Your Code as a Crime Scene 2015
          </div>
        </div>

        {/* Hero */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: space[4],
            padding: `${space[4]}px 0`,
            borderBottom: `1px solid ${tokenColor.borderSoft}`,
            marginBottom: space[4],
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              fontSize: 36,
              lineHeight: 1.1,
              fontWeight: font.weight.bold,
              color: tokenColor.text0,
              letterSpacing: font.letter.tight,
              fontFamily: font.mono,
              maxWidth: "60%",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={entity.path}
          >
            {entity.name}
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            <div
              style={{
                fontSize: font.size.xxs,
                color: tokenColor.text2,
                textTransform: "uppercase",
                letterSpacing: font.letter.ultra,
              }}
            >
              File rating
            </div>
            <div
              style={{
                fontSize: font.size.xl,
                fontWeight: font.weight.bold,
                color: rating.color,
                letterSpacing: font.letter.tight,
              }}
            >
              {rating.label}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              gap: space[4],
              marginLeft: "auto",
              fontSize: font.size.xxs,
              color: tokenColor.text2,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            <Stat label="functions" value={`${rows.length}`} />
            <Stat label="peak hot" value={`${Math.round(stats.peak * 100)}%`} tone={hotnessSolid(stats.peak)} />
            <Stat label="avg hot" value={`${Math.round(stats.avg * 100)}%`} />
            <Stat label="file churn" value={`${Math.round(fileCh * 100)}%`} />
          </div>
        </div>

        {/* Per-function heat chart */}
        <div
          style={{
            marginBottom: space[5],
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
            Per-function heat (desc)
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              padding: `${space[3]}px ${space[3]}px`,
              background: tokenColor.bg2,
              border: `1px solid ${tokenColor.border}`,
              borderRadius: radiusToken.md,
            }}
          >
            {rows.slice(0, 10).map((r, i) => {
              const pct = (r.hotness / maxHot) * 100;
              return (
                <div
                  key={`chart-${r.symbol.id}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "180px 1fr 48px",
                    columnGap: space[2],
                    alignItems: "center",
                    animation: `xrItemIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
                    animationDelay: `${60 + Math.min(i * STAGGER_MS, 300)}ms`,
                  }}
                >
                  <span
                    title={r.symbol.name}
                    style={{
                      fontFamily: font.mono,
                      fontSize: font.size.xxs,
                      color: tokenColor.text1,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {r.symbol.name}
                  </span>
                  <div
                    style={{
                      height: 10,
                      borderRadius: radiusToken.pill,
                      background: tokenColor.bg3,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        ["--xr-bar-target" as string]: `${pct}%`,
                        width: `${pct}%`,
                        height: "100%",
                        background: hotnessGradient(r.hotness),
                        borderRadius: radiusToken.pill,
                        animation: `xrBarGrow 560ms ${ENTRY_EASE} both`,
                        animationDelay: `${120 + Math.min(i * STAGGER_MS, 300)}ms`,
                      } as CSSProperties}
                    />
                  </div>
                  <span
                    style={{
                      fontFamily: font.mono,
                      fontSize: font.size.xxs,
                      color: tokenColor.text0,
                      fontWeight: font.weight.semibold,
                      fontVariantNumeric: "tabular-nums",
                      textAlign: "right",
                    }}
                  >
                    {Math.round(r.hotness * 100)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Column legend */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 80px 80px 80px 80px 160px",
            columnGap: space[2],
            fontSize: font.size.xxs,
            color: tokenColor.text2,
            paddingBottom: space[1],
            paddingLeft: space[2],
            borderBottom: `1px solid ${tokenColor.border}`,
            marginBottom: space[1],
            textTransform: "uppercase",
            letterSpacing: font.letter.ultra,
          }}
        >
          <div>Function</div>
          <div>Vis</div>
          <div>LoC</div>
          <div>Cog CX</div>
          <div>Commits</div>
          <div>Hotness</div>
        </div>

        {/* Rows */}
        {rows.map((r, i) => {
          const isHovered = hoveredId === r.symbol.id;
          const hotPct = Math.round(r.hotness * 100);
          const vis = VIS_STYLE[r.symbol.visibility];
          const rowStyle: CSSProperties = {
            display: "grid",
            gridTemplateColumns: "1fr 80px 80px 80px 80px 160px",
            columnGap: space[2],
            alignItems: "center",
            padding: `${space[2]}px ${space[2]}px`,
            borderRadius: radiusToken.md,
            background: isHovered ? tokenColor.hover : "transparent",
            transition: `background 180ms ease-out, transform 180ms ease-out`,
            transform: isHovered ? "scale(1.005)" : "scale(1)",
            transformOrigin: "left center",
            animation: `xrItemIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
            animationDelay: `${100 + Math.min(i * STAGGER_MS, 400)}ms`,
            borderBottom: `1px solid ${tokenColor.borderSoft}`,
          };
          return (
            <div
              key={r.symbol.id}
              style={rowStyle}
              onMouseEnter={() => setHoveredId(r.symbol.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              {/* name + kind + line */}
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: font.mono,
                    fontSize: font.size.sm,
                    fontWeight: font.weight.medium,
                    color: tokenColor.text0,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {r.symbol.name}
                </div>
                <div
                  style={{
                    fontFamily: font.mono,
                    fontSize: font.size.xxs,
                    color: tokenColor.text3,
                    marginTop: 2,
                  }}
                >
                  {r.symbol.kind} · line {r.symbol.line}
                </div>
              </div>

              {/* visibility pill */}
              <div>
                <span
                  style={{
                    display: "inline-block",
                    padding: "1px 6px",
                    fontSize: font.size.xxs,
                    fontFamily: font.mono,
                    fontWeight: font.weight.semibold,
                    background: vis.bg,
                    color: vis.fg,
                    borderRadius: radiusToken.pill,
                  }}
                >
                  {vis.label}
                </span>
              </div>

              {/* LoC */}
              <div
                style={{
                  fontFamily: font.mono,
                  fontSize: font.size.sm,
                  color: tokenColor.text1,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {r.symbol.loc}
              </div>

              {/* cognitive complexity */}
              <div
                style={{
                  fontFamily: font.mono,
                  fontSize: font.size.sm,
                  fontVariantNumeric: "tabular-nums",
                  color:
                    r.symbol.cognitive >= 15
                      ? tokenColor.danger
                      : r.symbol.cognitive >= 8
                      ? tokenColor.warn
                      : tokenColor.text1,
                  fontWeight: r.symbol.cognitive >= 15 ? font.weight.semibold : font.weight.regular,
                }}
              >
                {r.symbol.cognitive}
              </div>

              {/* commits */}
              <div
                style={{
                  fontFamily: font.mono,
                  fontSize: font.size.sm,
                  color: tokenColor.text1,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {r.commits}
              </div>

              {/* hotness meter */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: space[2],
                }}
              >
                <div
                  style={{
                    flex: 1,
                    height: 8,
                    borderRadius: radiusToken.pill,
                    background: tokenColor.bg3,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      ["--xr-bar-target" as string]: `${hotPct}%`,
                      width: `${hotPct}%`,
                      height: "100%",
                      background: hotnessGradient(r.hotness),
                      borderRadius: radiusToken.pill,
                      animation: `xrBarGrow 560ms ${ENTRY_EASE} both`,
                      animationDelay: `${200 + Math.min(i * STAGGER_MS, 400)}ms`,
                    } as CSSProperties}
                  />
                </div>
                <span
                  style={{
                    fontFamily: font.mono,
                    fontSize: font.size.xs,
                    fontWeight: font.weight.semibold,
                    color: hotnessSolid(r.hotness),
                    fontVariantNumeric: "tabular-nums",
                    minWidth: 32,
                    textAlign: "right",
                  }}
                >
                  {hotPct}%
                </span>
              </div>
            </div>
          );
        })}

        {/* Footer legend */}
        <div
          style={{
            marginTop: space[4],
            fontSize: font.size.xxs,
            color: tokenColor.text3,
          }}
        >
          hotness = churn × cognitive complexity (per-symbol synth, seeded) · 상위 함수가 리팩터 목표
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}): ReactElement {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
      }}
    >
      <span
        style={{
          fontSize: font.size.xxs,
          color: tokenColor.text3,
          textTransform: "uppercase",
          letterSpacing: font.letter.ultra,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: font.size.md,
          fontWeight: font.weight.semibold,
          color: tone ?? tokenColor.text0,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </span>
    </div>
  );
}

export const XRayHotspotView = memo(XRayHotspotViewImpl);
