// UncertaintyMapView — reliability diagram for model calibration.
// --------------------------------------------------------------------
// Top: 4 hero tiles — avg calibration error, overconfident count,
//      underconfident count, well-calibrated count.
// Middle: reliability diagram. X = claimed confidence bin, Y = actual
//         accuracy. Diagonal = perfect calibration. Dots above the
//         diagonal are underconfident (good-ish), dots below are
//         overconfident (dangerous). Bar chart underneath the plot
//         shows per-bin mean gap.
// Right: ranked list of worst-calibrated files with over/under badges.
// Bottom: insight card highlighting overconfident files as highest
//         risk.
//
// Reference: Guo et al. ICML 2017 · Kadavath 2022 · Wightman 2024.

import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactElement } from "react";

import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, shadow, space } from "../../../shared/ui/tokens";
import {
  uncertaintyMap,
  type UncertaintyPoint,
} from "../../../shared/analytics/synth-metrics";

interface Props {
  ctx: ViewContextValue;
}

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 520;

const KEYFRAMES = `
@keyframes um-enter { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
@keyframes um-row   { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
@keyframes um-dot   { from { opacity: 0; transform: scale(0.3); } to { opacity: 1; transform: scale(1); } }
@keyframes um-bar   { from { transform: scaleY(0); } to { transform: scaleY(1); } }
`;

const PLOT_SIZE = 340;
const PLOT_PAD = 44;

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function useRafCounter(target: number, durationMs = 640): number {
  const [v, setV] = useState(0);
  const started = useRef<number | null>(null);
  useEffect(() => {
    started.current = null;
    let raf = 0;
    const tick = (t: number): void => {
      if (started.current === null) started.current = t;
      const k = Math.min(1, (t - started.current) / durationMs);
      const eased = 1 - Math.pow(1 - k, 3);
      setV(target * eased);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return v;
}

function UncertaintyMapViewImpl({ ctx }: Props): ReactElement {
  const points = useMemo<UncertaintyPoint[]>(
    () => (ctx.tree ? uncertaintyMap(ctx.tree) : []),
    [ctx.tree],
  );

  const stats = useMemo(() => {
    if (points.length === 0) {
      return {
        avgError: 0,
        over: 0,
        under: 0,
        wellCal: 0,
        bins: [] as Array<{ lo: number; hi: number; claimed: number; actual: number; n: number }>,
      };
    }
    let errSum = 0;
    let over = 0;
    let under = 0;
    for (const p of points) {
      errSum += p.calibrationError;
      if (p.overconfident) over += 1;
      else if (p.underconfident) under += 1;
    }
    const wellCal = points.length - over - under;

    // 10 bins over claimed confidence.
    const binN = 10;
    const bins: Array<{ lo: number; hi: number; claimed: number; actual: number; n: number }> = [];
    for (let i = 0; i < binN; i++) {
      const lo = i / binN;
      const hi = (i + 1) / binN;
      let cSum = 0;
      let aSum = 0;
      let n = 0;
      for (const p of points) {
        if (p.claimedConfidence >= lo && p.claimedConfidence < hi + (i === binN - 1 ? 0.0001 : 0)) {
          cSum += p.claimedConfidence;
          aSum += p.actualAccuracy;
          n += 1;
        }
      }
      bins.push({
        lo,
        hi,
        claimed: n > 0 ? cSum / n : (lo + hi) / 2,
        actual: n > 0 ? aSum / n : 0,
        n,
      });
    }
    return {
      avgError: errSum / points.length,
      over,
      under,
      wellCal,
      bins,
    };
  }, [points]);

  const worstList = useMemo(
    () => [...points].sort((a, b) => b.calibrationError - a.calibrationError).slice(0, 12),
    [points],
  );

  const errorPct = useRafCounter(Math.round(stats.avgError * 100));

  if (!ctx.tree || points.length === 0) {
    return (
      <div style={rootStyle}>
        <style>{KEYFRAMES}</style>
        <div style={emptyStyle}>캘리브레이션 데이터가 없어요.</div>
      </div>
    );
  }

  const toX = (v: number): number => PLOT_PAD + v * (PLOT_SIZE - PLOT_PAD * 2);
  const toY = (v: number): number => PLOT_SIZE - PLOT_PAD - v * (PLOT_SIZE - PLOT_PAD * 2);

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>

      <header style={headerStyle}>
        <div>
          <div style={titleStyle}>Uncertainty Map</div>
          <div style={subtitleStyle}>
            {points.length}개 파일 · claimed vs actual accuracy · reliability diagram
          </div>
        </div>
        <div style={{ fontFamily: font.mono, fontSize: font.size.xxs, color: color.text3 }}>
          Guo ICML 2017 · Kadavath 2022 · Wightman 2024
        </div>
      </header>

      {/* Hero tiles */}
      <div style={heroStripStyle}>
        <HeroTile
          label="avg calibration error"
          value={`${Math.round(errorPct)}%`}
          sub="|claimed − actual|"
          accent={color.accent}
        />
        <HeroTile
          label="overconfident"
          value={stats.over.toString()}
          sub="가장 위험 — AI says 'sure'"
          accent={color.danger}
        />
        <HeroTile
          label="underconfident"
          value={stats.under.toString()}
          sub="모델이 과소평가"
          accent={color.warn}
        />
        <HeroTile
          label="well-calibrated"
          value={stats.wellCal.toString()}
          sub={`${Math.round((stats.wellCal / points.length) * 100)}% of files`}
          accent={color.success}
        />
      </div>

      <div style={mainGridStyle}>
        {/* Reliability plot */}
        <section style={plotCardStyle}>
          <div style={cardHeadStyle}>
            <span style={cardTitleStyle}>reliability diagram</span>
            <span style={cardSubStyle}>diagonal = perfect calibration</span>
          </div>

          <div style={{ padding: space[3], display: "flex", justifyContent: "center" }}>
            <svg width={PLOT_SIZE} height={PLOT_SIZE} role="img" aria-label="reliability diagram">
              {/* Plot bg */}
              <rect
                x={PLOT_PAD}
                y={PLOT_PAD}
                width={PLOT_SIZE - PLOT_PAD * 2}
                height={PLOT_SIZE - PLOT_PAD * 2}
                fill={color.bg2}
                stroke={color.border}
                strokeWidth={1}
              />

              {/* Grid */}
              {[0.25, 0.5, 0.75].map(t => (
                <g key={`gx-${t}`}>
                  <line
                    x1={toX(t)}
                    y1={toY(0)}
                    x2={toX(t)}
                    y2={toY(1)}
                    stroke={color.border}
                    strokeDasharray="3 4"
                    strokeOpacity={0.5}
                  />
                  <line
                    x1={toX(0)}
                    y1={toY(t)}
                    x2={toX(1)}
                    y2={toY(t)}
                    stroke={color.border}
                    strokeDasharray="3 4"
                    strokeOpacity={0.5}
                  />
                </g>
              ))}

              {/* Above-diagonal tint (underconfident zone) */}
              <polygon
                points={`${toX(0)},${toY(0)} ${toX(1)},${toY(1)} ${toX(0)},${toY(1)}`}
                fill={color.warn}
                opacity={0.05}
              />
              {/* Below-diagonal tint (overconfident zone — danger) */}
              <polygon
                points={`${toX(0)},${toY(0)} ${toX(1)},${toY(1)} ${toX(1)},${toY(0)}`}
                fill={color.danger}
                opacity={0.06}
              />

              {/* Perfect calibration diagonal */}
              <line
                x1={toX(0)}
                y1={toY(0)}
                x2={toX(1)}
                y2={toY(1)}
                stroke={color.text2}
                strokeWidth={1.5}
                strokeDasharray="4 4"
              />

              {/* Per-bin bars (actual − claimed gap, anchored on diagonal) */}
              {stats.bins.map((b, i) => {
                if (b.n === 0) return null;
                const cx = toX(b.claimed);
                const diagonalY = toY(b.claimed);
                const actualY = toY(b.actual);
                const barX = cx - 8;
                return (
                  <rect
                    key={`bar-${i}`}
                    x={barX}
                    y={Math.min(diagonalY, actualY)}
                    width={16}
                    height={Math.abs(actualY - diagonalY)}
                    fill={b.actual < b.claimed ? color.danger : color.success}
                    opacity={0.28}
                    style={{
                      transformOrigin: `${cx}px ${diagonalY}px`,
                      animation: `um-bar 540ms ${ENTRY_EASE} both`,
                      animationDelay: `${120 + i * 30}ms`,
                    }}
                  />
                );
              })}

              {/* Dots */}
              {points.slice(0, 200).map((p, i) => {
                const cx = toX(p.claimedConfidence);
                const cy = toY(p.actualAccuracy);
                const fill = p.overconfident
                  ? color.danger
                  : p.underconfident
                  ? color.warn
                  : color.success;
                return (
                  <g
                    key={p.fileId}
                    style={{
                      animation: `um-dot 520ms ${ENTRY_EASE} both`,
                      animationDelay: `${Math.min(200 + i * 10, 900)}ms`,
                      transformOrigin: `${cx}px ${cy}px`,
                      transformBox: "fill-box",
                    }}
                  >
                    <circle cx={cx} cy={cy} r={4.5} fill={fill} opacity={0.75} />
                  </g>
                );
              })}

              {/* Axes labels */}
              <text
                x={toX(0)}
                y={PLOT_SIZE - 12}
                fill={color.text2}
                fontSize={font.size.xxs}
                fontFamily={font.mono}
                textAnchor="start"
              >
                0
              </text>
              <text
                x={toX(1)}
                y={PLOT_SIZE - 12}
                fill={color.text2}
                fontSize={font.size.xxs}
                fontFamily={font.mono}
                textAnchor="end"
              >
                1
              </text>
              <text
                x={PLOT_SIZE / 2}
                y={PLOT_SIZE - 2}
                fill={color.text1}
                fontSize={font.size.xs}
                fontFamily={font.sans}
                fontWeight={font.weight.medium}
                textAnchor="middle"
              >
                claimed confidence →
              </text>
              <text
                x={12}
                y={PLOT_SIZE / 2}
                fill={color.text1}
                fontSize={font.size.xs}
                fontFamily={font.sans}
                fontWeight={font.weight.medium}
                textAnchor="middle"
                transform={`rotate(-90, 12, ${PLOT_SIZE / 2})`}
              >
                actual accuracy →
              </text>

              {/* Zone labels */}
              <text
                x={toX(0.18)}
                y={toY(0.88)}
                fill={color.warn}
                fontSize={font.size.xxs}
                fontFamily={font.sans}
                fontWeight={font.weight.semibold}
                opacity={0.9}
              >
                underconfident
              </text>
              <text
                x={toX(0.62)}
                y={toY(0.18)}
                fill={color.danger}
                fontSize={font.size.xxs}
                fontFamily={font.sans}
                fontWeight={font.weight.semibold}
                opacity={0.9}
              >
                overconfident · danger
              </text>
            </svg>
          </div>

          <div style={plotLegendStyle}>
            <span style={legendItemStyle}>
              <span style={{ ...legendDotStyle, background: color.danger }} /> overconfident
            </span>
            <span style={legendItemStyle}>
              <span style={{ ...legendDotStyle, background: color.warn }} /> underconfident
            </span>
            <span style={legendItemStyle}>
              <span style={{ ...legendDotStyle, background: color.success }} /> well-calibrated
            </span>
          </div>
        </section>

        {/* Worst list */}
        <aside style={listCardStyle}>
          <div style={cardHeadStyle}>
            <span style={cardTitleStyle}>worst-calibrated files</span>
            <span style={cardSubStyle}>top 12</span>
          </div>
          <div style={listScrollStyle}>
            {worstList.map((p, i) => {
              const badge = p.overconfident
                ? { label: "overconfident", c: color.danger }
                : p.underconfident
                ? { label: "underconfident", c: color.warn }
                : { label: "well-cal", c: color.success };
              const active = ctx.selectedId === p.fileId;
              return (
                <button
                  key={p.fileId}
                  type="button"
                  onClick={() => ctx.dispatch.selectEntity(p.fileId)}
                  style={{
                    ...listRowStyle,
                    background: active ? color.accentSofter : "transparent",
                    animation: `um-row 420ms ${ENTRY_EASE} both`,
                    animationDelay: `${180 + i * 26}ms`,
                  }}
                >
                  <span style={listRankStyle}>{i + 1}</span>
                  <span style={listNameWrapStyle}>
                    <span style={listNameStyle}>{p.fileName}</span>
                    <span style={listMetaStyle}>
                      claimed {pct(p.claimedConfidence)} · actual {pct(p.actualAccuracy)}
                    </span>
                  </span>
                  <span style={errorBarWrapStyle}>
                    <span style={errorBarTrackStyle}>
                      <span
                        style={{
                          ...errorBarFillStyle,
                          width: `${Math.round(p.calibrationError * 100)}%`,
                          background: badge.c,
                        }}
                      />
                    </span>
                    <span style={{ ...errorPctStyle, color: badge.c }}>
                      Δ{pct(p.calibrationError)}
                    </span>
                  </span>
                  <span style={{ ...listBadgeStyle, color: badge.c, borderColor: badge.c }}>
                    {badge.label}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>
      </div>

      <div style={insightCardStyle}>
        <div style={insightTitleStyle}>calibration insight</div>
        <div style={insightBodyStyle}>
          overconfident 파일은 가장 위험합니다. AI는 'sure' 라고 말하지만
          실제 정확도는 현저히 낮은 구간 — 리뷰 없이 수락 금지.
          underconfident 구간은 반대로 기회(모델이 과소평가) 이지만 우선순위는
          낮습니다.
        </div>
        <div style={insightRefStyle}>
          Expected Calibration Error (ECE) — Guo ICML 2017.
          "LMs mostly know what they know" — Kadavath 2022.
        </div>
      </div>
    </div>
  );
}

function HeroTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent: string;
}): ReactElement {
  return (
    <div style={heroTileStyle}>
      <div style={heroLabelStyle}>{label}</div>
      <div style={{ ...heroValueStyle, color: accent }}>{value}</div>
      <div style={heroSubStyle}>{sub}</div>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────

const rootStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  padding: `${space[5]}px ${space[6]}px`,
  background: color.bg0,
  boxSizing: "border-box",
  overflow: "auto",
  animation: `um-enter ${ENTRY_MS}ms ${ENTRY_EASE} both`,
  fontFamily: font.sans,
  color: color.text0,
  display: "flex",
  flexDirection: "column",
  gap: space[4],
};

const emptyStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: color.text3,
  fontSize: font.size.md,
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  padding: `${space[3]}px ${space[4]}px`,
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.lg,
};

const titleStyle: CSSProperties = {
  fontSize: font.size.xxl,
  fontWeight: font.weight.semibold,
  letterSpacing: font.letter.tight,
};

const subtitleStyle: CSSProperties = {
  fontSize: font.size.xs,
  color: color.text2,
  fontFamily: font.mono,
  marginTop: 2,
};

const heroStripStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: space[3],
};

const heroTileStyle: CSSProperties = {
  padding: space[3],
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  boxShadow: shadow.xs,
};

const heroLabelStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  fontWeight: font.weight.semibold,
};

const heroValueStyle: CSSProperties = {
  fontSize: 26,
  fontFamily: font.mono,
  fontWeight: font.weight.bold,
  lineHeight: 1.1,
  fontVariantNumeric: "tabular-nums",
  letterSpacing: -0.4,
  marginTop: 4,
};

const heroSubStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text3,
  fontFamily: font.mono,
  marginTop: 2,
};

const mainGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(380px, 1fr) minmax(320px, 1fr)",
  gap: space[3],
};

const plotCardStyle: CSSProperties = {
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.lg,
  overflow: "hidden",
};

const cardHeadStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  padding: `${space[2]}px ${space[3]}px`,
  borderBottom: `1px solid ${color.border}`,
};

const cardTitleStyle: CSSProperties = {
  fontSize: font.size.sm,
  fontWeight: font.weight.semibold,
  color: color.text0,
};

const cardSubStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text3,
  fontFamily: font.mono,
};

const plotLegendStyle: CSSProperties = {
  display: "flex",
  gap: space[4],
  padding: `0 ${space[3]}px ${space[3]}px`,
  fontSize: font.size.xxs,
  color: color.text2,
  justifyContent: "center",
};

const legendItemStyle: CSSProperties = {
  display: "inline-flex",
  gap: 6,
  alignItems: "center",
};

const legendDotStyle: CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: radius.pill,
};

const listCardStyle: CSSProperties = {
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.lg,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const listScrollStyle: CSSProperties = {
  overflowY: "auto",
  flex: 1,
};

const listRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "24px minmax(0, 1.3fr) minmax(0, 1fr) auto",
  alignItems: "center",
  gap: space[2],
  padding: `${space[2]}px ${space[3]}px`,
  borderBottom: `1px solid ${color.border}`,
  width: "100%",
  border: "none",
  borderTop: "none",
  cursor: "pointer",
  fontFamily: "inherit",
  textAlign: "left",
};

const listRankStyle: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.xxs,
  color: color.text3,
  textAlign: "right",
};

const listNameWrapStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
};

const listNameStyle: CSSProperties = {
  fontSize: font.size.sm,
  color: color.text0,
  fontWeight: font.weight.medium,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const listMetaStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text3,
  fontFamily: font.mono,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const errorBarWrapStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[2],
  minWidth: 0,
};

const errorBarTrackStyle: CSSProperties = {
  flex: 1,
  height: 6,
  background: color.bg3,
  borderRadius: radius.pill,
  overflow: "hidden",
};

const errorBarFillStyle: CSSProperties = {
  height: "100%",
  borderRadius: radius.pill,
  opacity: 0.85,
};

const errorPctStyle: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.xxs,
  fontWeight: font.weight.semibold,
  fontVariantNumeric: "tabular-nums",
  width: 40,
  textAlign: "right",
};

const listBadgeStyle: CSSProperties = {
  display: "inline-block",
  padding: "2px 8px",
  fontSize: font.size.xxs,
  fontFamily: font.mono,
  fontWeight: font.weight.semibold,
  background: color.bg0,
  border: `1px solid`,
  borderRadius: radius.pill,
};

const insightCardStyle: CSSProperties = {
  padding: space[3],
  background: color.accentSofter,
  border: `1px solid ${color.accentBorder}`,
  borderRadius: radius.lg,
  display: "flex",
  flexDirection: "column",
  gap: space[2],
};

const insightTitleStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.accent,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  fontWeight: font.weight.semibold,
};

const insightBodyStyle: CSSProperties = {
  fontSize: font.size.xs,
  color: color.text0,
  lineHeight: 1.5,
};

const insightRefStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  fontFamily: font.mono,
  lineHeight: 1.45,
};

export const UncertaintyMapView = memo(UncertaintyMapViewImpl);
