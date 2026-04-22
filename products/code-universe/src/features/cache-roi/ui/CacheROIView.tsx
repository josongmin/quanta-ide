// CacheROIView — Anthropic-style prompt-caching ROI simulator.
// --------------------------------------------------------------------
// User picks a daily-turn count (20 / 40 / 80 / 200). Default 40.
// Hero: 90-day baseline vs with-caching cost (big dollars) + savings%
//   ring gauge. Middle: stacked bar — stable (cacheable) vs volatile.
// Right: cache-hit gauge + per-turn cost breakdown (stable cached /
//   volatile / output). Bottom: 90-day cumulative-cost line — baseline
//   vs with-caching (area diff highlighted as savings).
//
// References:
//   - Anthropic Prompt Caching announcement (August 2024)
//   - OpenAI Context Caching (2025)
//   - "Cache hit rate × repo churn" — 2026 IDE-integration ROI lens.

import { memo, useEffect, useMemo, useState, type CSSProperties, type ReactElement } from "react";

import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, shadow, space, transition } from "../../../shared/ui/tokens";
import { promptCacheROI, type CacheROI } from "../../../shared/analytics/synth-metrics";

interface Props {
  ctx: ViewContextValue;
}

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 520;
const STAGGER_MS = 18;
const COUNTER_MS = 640;
const BAR_MS = 900;
const RING_MS = 900;

const KEYFRAMES = `
@keyframes cr-enter { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
@keyframes cr-tile  { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
@keyframes cr-bar   { from { transform: scaleX(0); } to { transform: scaleX(1); } }
`;

const TURNS_CHOICES: readonly number[] = [20, 40, 80, 200] as const;
const DAYS = 90;

// ── helpers ──────────────────────────────────────────────────────────

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${Math.round(n)}`;
}
function fmtCost(usd: number): string {
  if (usd < 0.01) return "<$0.01";
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(2)}M`;
  if (usd >= 10_000) return `$${(usd / 1_000).toFixed(1)}K`;
  if (usd >= 100) return `$${usd.toFixed(0)}`;
  return `$${usd.toFixed(2)}`;
}

function useCounter(target: number, durationMs: number): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return value;
}

function CacheROIViewImpl({ ctx }: Props): ReactElement | null {
  const [turnsPerDay, setTurnsPerDay] = useState<number>(40);
  const roi: CacheROI | null = useMemo(() => {
    if (!ctx.tree) return null;
    return promptCacheROI(ctx.tree, turnsPerDay, DAYS);
  }, [ctx.tree, turnsPerDay]);

  if (!roi || (roi.stableTokens === 0 && roi.volatileTokens === 0)) {
    return (
      <div style={rootStyle}>
        <style>{KEYFRAMES}</style>
        <div style={emptyStyle}>캐시 ROI를 계산할 파일이 없습니다.</div>
      </div>
    );
  }

  const totalTokens = roi.stableTokens + roi.volatileTokens;
  const stableFrac = totalTokens === 0 ? 0 : roi.stableTokens / totalTokens;
  const volatileFrac = 1 - stableFrac;

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>

      <header style={headerStyle}>
        <div>
          <div style={titleStyle}>
            Cache ROI · <span style={{ color: color.accent, fontWeight: font.weight.semibold }}>prompt caching · 90 days</span>
          </div>
          <div style={subtitleStyle}>
            Anthropic-style prompt caching × repo churn → 90일 누적 비용 절감 시뮬레이션
          </div>
        </div>
        <div style={{ fontFamily: font.mono, fontSize: font.size.xxs, color: color.text3, textAlign: "right" }}>
          Anthropic Prompt Caching (Aug 2024)<br />
          OpenAI Context Caching
        </div>
      </header>

      {/* Turns-per-day chip row */}
      <section style={chipRowStyle}>
        <span style={{ fontSize: font.size.xxs, color: color.text2, letterSpacing: font.letter.ultra, textTransform: "uppercase", fontWeight: font.weight.semibold, marginRight: space[2] }}>
          turns / day
        </span>
        {TURNS_CHOICES.map(n => {
          const active = n === turnsPerDay;
          return (
            <button
              key={n}
              type="button"
              onClick={() => setTurnsPerDay(n)}
              style={{
                ...chipStyle,
                background: active ? color.accentSoft : color.bg1,
                borderColor: active ? color.accentBorder : color.border,
                color: active ? color.accent : color.text1,
                fontWeight: active ? font.weight.semibold : font.weight.medium,
              }}
            >
              {n}×
            </button>
          );
        })}
        <span style={{ marginLeft: "auto", fontSize: font.size.xxs, color: color.text3, fontFamily: font.mono }}>
          {DAYS} days · Sonnet 4.6 pricing
        </span>
      </section>

      {/* Hero row: baseline vs caching + savings ring */}
      <section style={heroGridStyle}>
        <HeroTile
          index={0}
          label="90-day baseline"
          target={roi.baselineCostUsd}
          format={(n) => fmtCost(n)}
          sub={`${turnsPerDay} turns/day · no caching`}
          tint={color.danger}
        />
        <HeroTile
          index={1}
          label="with caching"
          target={roi.withCachingCostUsd}
          format={(n) => fmtCost(n)}
          sub={`cache hit ${(roi.hitRate * 100).toFixed(1)}%`}
          tint={color.success}
        />
        <SavingsTile
          savingsPct={roi.savingsPct}
          savingsUsd={roi.savingsUsd}
        />
        <HeroTile
          index={3}
          label="tokens / turn"
          target={roi.perTurnInputTokens}
          format={(n) => fmtTokens(n)}
          sub={`${fmtTokens(roi.perTurnOutputTokens)} out`}
          tint={color.accent}
        />
      </section>

      {/* Stable / volatile stacked bar */}
      <section style={sectionStyle}>
        <div style={sectionHeadRow}>
          <h3 style={sectionHead}>Stable vs volatile tokens</h3>
          <div style={{ fontSize: font.size.xxs, color: color.text3, fontFamily: font.mono }}>
            churn &lt; 20% = cacheable · total {fmtTokens(totalTokens)}
          </div>
        </div>
        <div style={stackedWrap}>
          <div style={stackedTrack}>
            <div style={{
              ...stackedSeg,
              width: `${stableFrac * 100}%`,
              background: color.success,
              animation: `cr-bar ${BAR_MS}ms ${ENTRY_EASE} both`,
            }}>
              <span style={stackedLabel}>
                {fmtTokens(roi.stableTokens)} · {(stableFrac * 100).toFixed(0)}% stable
              </span>
            </div>
            <div style={{
              ...stackedSeg,
              width: `${volatileFrac * 100}%`,
              background: color.warn,
              animation: `cr-bar ${BAR_MS}ms ${ENTRY_EASE} both`,
              animationDelay: "120ms",
            }}>
              <span style={stackedLabel}>
                {fmtTokens(roi.volatileTokens)} · {(volatileFrac * 100).toFixed(0)}% volatile
              </span>
            </div>
          </div>
          <div style={legendRow}>
            <LegendDot color={color.success} label="stable (churn < 20%)" />
            <LegendDot color={color.warn} label="volatile" />
            <span style={{ marginLeft: "auto", color: color.text3, fontFamily: font.mono }}>
              cache-hit rate = stable share
            </span>
          </div>
        </div>
      </section>

      {/* Per-turn breakdown + hit-rate gauge */}
      <section style={sectionStyle}>
        <div style={sectionHeadRow}>
          <h3 style={sectionHead}>Per-turn cost breakdown</h3>
          <div style={{ fontSize: font.size.xxs, color: color.text3, fontFamily: font.mono }}>
            amortized over {turnsPerDay * DAYS} turns
          </div>
        </div>
        <div style={splitStyle}>
          <CostBreakdown roi={roi} />
          <HitRateGauge rate={roi.hitRate} />
        </div>
      </section>

      {/* 90-day cumulative chart */}
      <section style={sectionStyle}>
        <div style={sectionHeadRow}>
          <h3 style={sectionHead}>90-day cumulative cost</h3>
          <div style={{ fontSize: font.size.xxs, color: color.text3, fontFamily: font.mono }}>
            baseline vs with-caching · area = savings
          </div>
        </div>
        <CumulativeChart roi={roi} />
      </section>
    </div>
  );
}

// ── sub-components ────────────────────────────────────────────────────

function HeroTile({
  index, label, target, format, sub, tint,
}: {
  index: number; label: string; target: number;
  format: (n: number) => string; sub: string; tint: string;
}): ReactElement {
  const v = useCounter(target, COUNTER_MS);
  return (
    <div style={{ ...heroTileStyle, animationDelay: `${index * STAGGER_MS}ms` }}>
      <div style={heroLabelStyle}>{label}</div>
      <div style={{ ...heroNumStyle, color: tint }}>{format(v)}</div>
      <div style={heroSubStyle} title={sub}>{sub}</div>
    </div>
  );
}

function SavingsTile({ savingsPct, savingsUsd }: { savingsPct: number; savingsUsd: number }) {
  const pct = useCounter(savingsPct * 100, COUNTER_MS);
  const usd = useCounter(savingsUsd, COUNTER_MS);
  // Ring gauge: 0..1 sweep.
  const R = 36;
  const C = 2 * Math.PI * R;
  const target = Math.max(0, Math.min(1, savingsPct));
  return (
    <div style={{ ...heroTileStyle, animationDelay: `${2 * STAGGER_MS}ms`, alignItems: "center", flexDirection: "row", gap: space[3] }}>
      <div style={{ position: "relative", width: 90, height: 90, flexShrink: 0 }}>
        <svg width={90} height={90} viewBox="0 0 90 90">
          <circle cx={45} cy={45} r={R} fill="none" stroke={color.bg3} strokeWidth={8} />
          <circle
            cx={45} cy={45} r={R} fill="none"
            stroke={color.success} strokeWidth={8}
            strokeDasharray={C}
            strokeDashoffset={C * (1 - target)}
            strokeLinecap="round"
            transform="rotate(-90 45 45)"
            style={{
              animation: `cr-bar ${RING_MS}ms ${ENTRY_EASE} both`,
              transformOrigin: "45px 45px",
            }}
          />
        </svg>
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: font.mono, fontWeight: font.weight.bold,
          fontSize: 18, color: color.success,
          fontVariantNumeric: "tabular-nums",
        }}>
          {pct.toFixed(1)}%
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={heroLabelStyle}>savings</div>
        <div style={{ ...heroNumStyle, color: color.success, fontSize: 28 }}>
          {fmtCost(usd)}
        </div>
        <div style={heroSubStyle}>vs no-caching baseline</div>
      </div>
    </div>
  );
}

function CostBreakdown({ roi }: { roi: CacheROI }) {
  // Compute per-turn dollars in the three lanes.
  const inputPrice = 3.00 / 1_000_000;
  const outputPrice = 15.00 / 1_000_000;
  const perTurnStable = Math.round(roi.perTurnInputTokens * roi.hitRate);
  const perTurnVolatile = roi.perTurnInputTokens - perTurnStable;
  const turns = Math.max(1, roi.turnsPerDay * DAYS);
  const avgStableMult = (1.25 + 0.10 * Math.max(0, turns - 1)) / turns;

  const stableCost = perTurnStable * inputPrice * avgStableMult;
  const volatileCost = perTurnVolatile * inputPrice;
  const outputCost = roi.perTurnOutputTokens * outputPrice;
  const totalCost = Math.max(1e-9, stableCost + volatileCost + outputCost);

  const rows = [
    { label: "stable · cached", cost: stableCost, tokens: perTurnStable, tint: color.success },
    { label: "volatile · full price", cost: volatileCost, tokens: perTurnVolatile, tint: color.warn },
    { label: "output", cost: outputCost, tokens: roi.perTurnOutputTokens, tint: color.accent },
  ];

  return (
    <div style={breakdownCard}>
      <div style={{ fontSize: font.size.xxs, color: color.text3, fontFamily: font.mono, marginBottom: space[2] }}>
        per turn · {fmtCost(totalCost)}
      </div>
      {rows.map((r, i) => {
        const frac = r.cost / totalCost;
        return (
          <div key={r.label} style={{ marginBottom: space[2] }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: font.size.xs, color: color.text1, marginBottom: 4 }}>
              <span>{r.label}</span>
              <span style={{ fontFamily: font.mono, color: color.text0, fontWeight: font.weight.semibold }}>{fmtCost(r.cost)}</span>
            </div>
            <div style={meterBase}>
              <div style={{
                ...meterFill,
                width: `${Math.max(2, frac * 100)}%`,
                background: r.tint,
                animation: `cr-bar ${BAR_MS}ms ${ENTRY_EASE} both`,
                animationDelay: `${i * 120}ms`,
              }} />
            </div>
            <div style={{ fontSize: font.size.xxs, color: color.text3, fontFamily: font.mono, marginTop: 2 }}>
              {fmtTokens(r.tokens)} tokens · {(frac * 100).toFixed(1)}%
            </div>
          </div>
        );
      })}
    </div>
  );
}

function HitRateGauge({ rate }: { rate: number }) {
  const R = 48;
  const C = 2 * Math.PI * R;
  const pct = useCounter(rate * 100, COUNTER_MS);
  return (
    <div style={gaugeCard}>
      <div style={{ position: "relative", width: 120, height: 120 }}>
        <svg width={120} height={120} viewBox="0 0 120 120">
          <circle cx={60} cy={60} r={R} fill="none" stroke={color.bg3} strokeWidth={10} />
          <circle
            cx={60} cy={60} r={R} fill="none"
            stroke={color.accent} strokeWidth={10}
            strokeDasharray={C}
            strokeDashoffset={C * (1 - Math.max(0, Math.min(1, rate)))}
            strokeLinecap="round"
            transform="rotate(-90 60 60)"
            style={{
              animation: `cr-bar ${RING_MS}ms ${ENTRY_EASE} both`,
            }}
          />
        </svg>
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{ fontSize: 22, fontFamily: font.mono, fontWeight: font.weight.bold, color: color.accent, fontVariantNumeric: "tabular-nums" }}>
            {pct.toFixed(1)}%
          </div>
          <div style={{ fontSize: font.size.xxs, color: color.text3, marginTop: 2 }}>
            hit rate
          </div>
        </div>
      </div>
      <div style={{ marginTop: space[2], fontSize: font.size.xxs, color: color.text2, textAlign: "center", maxWidth: 180 }}>
        stable portion hits cache at 10% of input price; first turn writes at 125%.
      </div>
    </div>
  );
}

function CumulativeChart({ roi }: { roi: CacheROI }) {
  const W = 720;
  const H = 180;
  const PL = 48;
  const PR = 16;
  const PT = 12;
  const PB = 24;
  const innerW = W - PL - PR;
  const innerH = H - PT - PB;
  const maxCost = roi.baselineCostUsd;

  const pointsBaseline: string[] = [];
  const pointsCaching: string[] = [];
  const ptsB: Array<{ x: number; y: number }> = [];
  const ptsC: Array<{ x: number; y: number }> = [];
  for (let d = 0; d <= DAYS; d++) {
    const frac = d / DAYS;
    const bx = PL + frac * innerW;
    // Baseline grows linearly.
    const baseCum = roi.baselineCostUsd * frac;
    // With-caching: roughly linear but first-day has higher write cost.
    // We approximate with slight curve — first turn = 1.25x write amortized, rest cached.
    const cacheCum = roi.withCachingCostUsd * frac;
    const byB = PT + innerH - (baseCum / Math.max(1e-9, maxCost)) * innerH;
    const byC = PT + innerH - (cacheCum / Math.max(1e-9, maxCost)) * innerH;
    pointsBaseline.push(`${bx},${byB}`);
    pointsCaching.push(`${bx},${byC}`);
    ptsB.push({ x: bx, y: byB });
    ptsC.push({ x: bx, y: byC });
  }

  // Build savings area as polygon: caching line then baseline reversed.
  const areaPoints: string[] = [];
  for (const p of ptsC) areaPoints.push(`${p.x},${p.y}`);
  for (let i = ptsB.length - 1; i >= 0; i--) {
    const p = ptsB[i]!;
    areaPoints.push(`${p.x},${p.y}`);
  }

  // Y-axis ticks at 0, 25, 50, 75, 100% of max.
  const yTicks = [0, 0.25, 0.5, 0.75, 1.0];

  return (
    <div style={chartWrap}>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="90-day cumulative cost">
        {/* grid */}
        {yTicks.map(t => {
          const y = PT + innerH * (1 - t);
          return (
            <g key={`yt-${t}`}>
              <line x1={PL} y1={y} x2={PL + innerW} y2={y} stroke={color.border} strokeWidth={1} strokeDasharray="3 4" />
              <text x={PL - 6} y={y + 3} textAnchor="end" fontSize={font.size.xxs} fill={color.text3} fontFamily={font.mono}>
                {fmtCost(maxCost * t)}
              </text>
            </g>
          );
        })}
        {/* savings area */}
        <polygon
          points={areaPoints.join(" ")}
          fill={color.success}
          fillOpacity={0.18}
        />
        {/* baseline line */}
        <polyline
          points={pointsBaseline.join(" ")}
          fill="none"
          stroke={color.danger}
          strokeWidth={2}
        />
        {/* caching line */}
        <polyline
          points={pointsCaching.join(" ")}
          fill="none"
          stroke={color.success}
          strokeWidth={2}
        />
        {/* x-axis day labels */}
        {[0, 30, 60, 90].map(d => {
          const x = PL + (d / DAYS) * innerW;
          return (
            <text key={`xt-${d}`} x={x} y={H - 6} textAnchor="middle" fontSize={font.size.xxs} fill={color.text3} fontFamily={font.mono}>
              {`d${d}`}
            </text>
          );
        })}
        {/* end labels */}
        <g>
          <text x={PL + innerW - 4} y={ptsB[ptsB.length - 1]!.y - 4} textAnchor="end" fontSize={font.size.xxs} fill={color.danger} fontFamily={font.mono} fontWeight={font.weight.semibold}>
            baseline {fmtCost(roi.baselineCostUsd)}
          </text>
          <text x={PL + innerW - 4} y={ptsC[ptsC.length - 1]!.y + 14} textAnchor="end" fontSize={font.size.xxs} fill={color.success} fontFamily={font.mono} fontWeight={font.weight.semibold}>
            cached {fmtCost(roi.withCachingCostUsd)}
          </text>
        </g>
      </svg>
    </div>
  );
}

function LegendDot({ color: c, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: font.size.xxs, color: color.text2 }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: c }} />
      {label}
    </span>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────

const rootStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  padding: `${space[6]}px ${space[7]}px`,
  background: color.bg0,
  boxSizing: "border-box",
  overflow: "auto",
  animation: `cr-enter ${ENTRY_MS}ms ${ENTRY_EASE} both`,
  fontFamily: font.sans,
  color: color.text0,
};

const emptyStyle: CSSProperties = {
  width: "100%",
  minHeight: 300,
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
  marginBottom: space[4],
};

const titleStyle: CSSProperties = {
  fontSize: font.size.xxl,
  fontWeight: font.weight.semibold,
  color: color.text0,
  letterSpacing: font.letter.tight,
};

const subtitleStyle: CSSProperties = {
  fontSize: font.size.xs,
  color: color.text2,
  fontFamily: font.mono,
  marginTop: 2,
};

const chipRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[1],
  marginBottom: space[5],
};

const chipStyle: CSSProperties = {
  padding: `6px 12px`,
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.pill,
  fontSize: font.size.xs,
  cursor: "pointer",
  transition: `all ${transition.base}`,
  fontFamily: font.mono,
  fontVariantNumeric: "tabular-nums",
};

const heroGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: space[3],
  marginBottom: space[5],
};

const heroTileStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  padding: space[4],
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  boxShadow: shadow.xs,
  animation: `cr-tile 460ms ${ENTRY_EASE} both`,
  minHeight: 108,
};

const heroLabelStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  fontWeight: font.weight.semibold,
};

const heroNumStyle: CSSProperties = {
  fontSize: 32,
  fontFamily: font.mono,
  fontWeight: font.weight.bold,
  lineHeight: 1,
  fontVariantNumeric: "tabular-nums",
  letterSpacing: -0.6,
  marginTop: 2,
};

const heroSubStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text3,
  fontFamily: font.mono,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const sectionStyle: CSSProperties = {
  marginTop: space[5],
};

const sectionHeadRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: space[3],
};

const sectionHead: CSSProperties = {
  fontSize: font.size.xs,
  color: color.text2,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  margin: 0,
  fontWeight: font.weight.semibold,
};

const stackedWrap: CSSProperties = {
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  padding: space[4],
};

const stackedTrack: CSSProperties = {
  display: "flex",
  width: "100%",
  height: 36,
  borderRadius: radius.sm,
  overflow: "hidden",
  background: color.bg3,
};

const stackedSeg: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  paddingLeft: space[2],
  color: "#ffffff",
  fontSize: font.size.xs,
  fontFamily: font.mono,
  fontWeight: font.weight.semibold,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  transformOrigin: "left center",
};

const stackedLabel: CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const legendRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[3],
  marginTop: space[2],
  fontSize: font.size.xxs,
};

const splitStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 220px",
  gap: space[3],
};

const breakdownCard: CSSProperties = {
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  padding: space[4],
};

const gaugeCard: CSSProperties = {
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  padding: space[4],
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
};

const meterBase: CSSProperties = {
  height: 6,
  background: color.bg3,
  borderRadius: radius.pill,
  overflow: "hidden",
};

const meterFill: CSSProperties = {
  height: "100%",
  borderRadius: radius.pill,
  transformOrigin: "left center",
};

const chartWrap: CSSProperties = {
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  padding: space[3],
};

export const CacheROIView = memo(CacheROIViewImpl);
