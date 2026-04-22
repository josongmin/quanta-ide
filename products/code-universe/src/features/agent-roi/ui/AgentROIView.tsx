// AgentROIView — monthly AI cost-vs-value ROI dashboard.
// --------------------------------------------------------------------
// Top: hero — animated cumulative ROI percentage
// (cumValue / cumCost × 100 − 100) plus a break-even month chip.
// Middle: dual-line chart — cost (red) vs value (green) over 12 months
// with the area between them shaded net-gain (green) or net-loss (red).
// Each line draws in via strokeDasharray animation.
// Bottom: tabular breakdown — month / cost / PRs merged / bugs fixed /
// imputed value / ROI %.
// Right: payback analysis that extrapolates months-to-recover from
// current trajectory.
//
// Reference: "AI productivity metrics" 2025 research consensus;
// Copilot and Cursor ROI studies (ZoomInfo 2024; Gartner 2025).

import { memo, useEffect, useMemo, useState, type CSSProperties, type ReactElement } from "react";

import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, shadow, space } from "../../../shared/ui/tokens";
import {
  agentROITimeline,
  type AgentROIPoint,
} from "../../../shared/analytics/synth-metrics";

interface Props {
  ctx: ViewContextValue;
}

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 520;
const STAGGER_MS = 16;
const COUNTER_MS = 640;
const LINE_DRAW_MS = 900;

const KEYFRAMES = `
@keyframes roi-enter { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
@keyframes roi-tile  { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
@keyframes roi-row   { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
@keyframes roi-draw  { from { stroke-dashoffset: var(--dash); } to { stroke-dashoffset: 0; } }
@keyframes roi-area  { from { opacity: 0; } to { opacity: 0.18; } }
`;

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

function fmtUsd(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toFixed(2)}`;
}

function monthLabel(idx: number, total: number): string {
  // monthIdx 0 = oldest, total-1 = most recent
  const monthsAgo = total - 1 - idx;
  const d = new Date();
  d.setMonth(d.getMonth() - monthsAgo);
  return d.toLocaleString("en-US", { month: "short" });
}

function AgentROIViewImpl({ ctx }: Props): ReactElement | null {
  const rootId = ctx.tree?.rootId ?? null;
  const series = useMemo(() => agentROITimeline(rootId, 12), [rootId]);

  if (!series || series.length === 0) {
    return (
      <div style={rootStyle}>
        <style>{KEYFRAMES}</style>
        <div style={emptyStyle}>ROI 데이터가 없습니다.</div>
      </div>
    );
  }

  const last = series[series.length - 1]!;
  const roiPct = last.cumCostUsd > 0 ? (last.cumValueUsd / last.cumCostUsd) * 100 - 100 : 0;
  const roiPositive = roiPct >= 0;

  // Break-even month = first month where cumValue >= cumCost.
  const breakEvenIdx = series.findIndex(p => p.cumValueUsd >= p.cumCostUsd);
  const breakEvenCopy = breakEvenIdx >= 0
    ? `${monthLabel(breakEvenIdx, series.length)}에 break-even 달성`
    : "아직 break-even 전";

  // Trajectory payback: if currently negative, estimate months to positive
  // based on the last 3 months' avg (cumValue - cumCost) delta.
  const paybackCopy = (() => {
    if (roiPositive) return "이미 흑자 — 투자 성공";
    if (series.length < 3) return "데이터 부족";
    const recent = series.slice(-3);
    const deltaPerMonth =
      (recent[recent.length - 1]!.cumValueUsd - recent[0]!.cumValueUsd) -
      (recent[recent.length - 1]!.cumCostUsd - recent[0]!.cumCostUsd);
    const netGap = last.cumCostUsd - last.cumValueUsd;
    if (deltaPerMonth <= 0) return "현재 추세로는 회수 불가 — 재평가 필요";
    const monthsToRecover = Math.ceil(netGap / (deltaPerMonth / 3));
    return `현재 추세 유지 시 ${monthsToRecover}개월 내 회수`;
  })();

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>

      <header style={headerStyle}>
        <div>
          <div style={titleStyle}>
            Agent ROI · <span style={{ color: color.accent, fontWeight: font.weight.semibold }}>12-month trajectory</span>
          </div>
          <div style={subtitleStyle}>
            cost vs imputed value · PR 40$ · bug 25$ · 누적 흐름
          </div>
        </div>
        <div style={{ fontFamily: font.mono, fontSize: font.size.xxs, color: color.text3, textAlign: "right" }}>
          AI productivity metrics 2025<br />
          ZoomInfo 2024 · Gartner 2025
        </div>
      </header>

      {/* Hero row */}
      <section style={heroGridStyle}>
        <HeroTile
          index={0}
          label="cumulative ROI"
          target={roiPct}
          format={(n) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`}
          tint={roiPositive ? color.success : color.danger}
          sub={`value ${fmtUsd(last.cumValueUsd)} · cost ${fmtUsd(last.cumCostUsd)}`}
        />
        <div style={{ ...heroTileStyle, animationDelay: `${STAGGER_MS}ms`, gridColumn: "span 2", minHeight: 108 }}>
          <div style={heroLabelStyle}>break-even</div>
          <div style={{ display: "flex", alignItems: "center", gap: space[3], marginTop: 4 }}>
            <div style={{
              padding: `6px 12px`,
              background: breakEvenIdx >= 0 ? `${color.success}18` : `${color.warn}18`,
              color: breakEvenIdx >= 0 ? color.success : color.warn,
              borderRadius: radius.pill,
              fontSize: font.size.sm,
              fontWeight: font.weight.semibold,
              letterSpacing: font.letter.wide,
              textTransform: "uppercase",
              fontFamily: font.mono,
            }}>
              {breakEvenIdx >= 0 ? "achieved" : "pending"}
            </div>
            <span style={{ fontSize: font.size.sm, color: color.text1 }}>{breakEvenCopy}</span>
          </div>
          <div style={{ display: "flex", gap: space[3], marginTop: space[3], fontSize: font.size.xxs, color: color.text3, fontFamily: font.mono }}>
            <span>cumCost &gt; cumValue = red</span>
            <span>cumValue &gt; cumCost = green</span>
          </div>
        </div>
        <HeroTile
          index={3}
          label="last-month net"
          target={last.valueUsd - last.costUsd}
          format={(n) => `${n >= 0 ? "+" : ""}${fmtUsd(Math.abs(n))}`}
          tint={last.valueUsd >= last.costUsd ? color.success : color.danger}
          sub={`${last.prsMerged} PRs · ${last.bugsFixed} bugs`}
        />
      </section>

      {/* Chart */}
      <section style={sectionStyle}>
        <div style={sectionHeadRow}>
          <h3 style={sectionHead}>Cost vs Value · monthly</h3>
          <Legend />
        </div>
        <ROIChart series={series} />
      </section>

      {/* Split: table + payback */}
      <section style={{ ...sectionStyle, display: "grid", gridTemplateColumns: "minmax(0, 1fr) 280px", gap: space[3] }}>
        <ROITable series={series} />
        <aside style={insightStyle}>
          <div style={insightLabelStyle}>payback</div>
          <div style={{ fontSize: font.size.lg, color: color.text0, fontWeight: font.weight.semibold, marginTop: 4 }}>
            trajectory analysis
          </div>
          <div style={{ fontSize: 28, fontFamily: font.mono, fontWeight: font.weight.bold, color: roiPositive ? color.success : color.warn, lineHeight: 1, marginTop: 6, letterSpacing: -0.4 }}>
            {fmtUsd(Math.abs(last.cumValueUsd - last.cumCostUsd))}
          </div>
          <div style={{ fontSize: font.size.xxs, color: color.text3, fontFamily: font.mono, marginTop: 2 }}>
            {roiPositive ? "net gain" : "net gap"} to recover
          </div>
          <div style={{ fontSize: font.size.xs, color: color.text1, marginTop: space[3], lineHeight: 1.55 }}>
            {paybackCopy}
          </div>
        </aside>
      </section>
    </div>
  );
}

// ── Hero tile ──────────────────────────────────────────────────────────

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
      <div style={{ fontSize: 38, fontFamily: font.mono, fontWeight: font.weight.bold, color: tint, lineHeight: 1, marginTop: 2, letterSpacing: -0.6, fontVariantNumeric: "tabular-nums" }}>
        {format(v)}
      </div>
      <div style={heroSubStyle}>{sub}</div>
    </div>
  );
}

// ── Chart ──────────────────────────────────────────────────────────────

function Legend(): ReactElement {
  const dotStyle: CSSProperties = { width: 10, height: 2, borderRadius: 2, display: "inline-block", marginRight: 4 };
  return (
    <div style={{ display: "flex", gap: space[3], fontSize: font.size.xxs, color: color.text2, fontFamily: font.mono }}>
      <span><span style={{ ...dotStyle, background: color.danger }} /> cost</span>
      <span><span style={{ ...dotStyle, background: color.success }} /> value</span>
    </div>
  );
}

function ROIChart({ series }: { series: AgentROIPoint[] }): ReactElement {
  const W = 720;
  const H = 260;
  const PL = 56; const PR = 16; const PT = 16; const PB = 36;
  const innerW = W - PL - PR;
  const innerH = H - PT - PB;

  const maxVal = Math.max(
    1e-6,
    ...series.map(s => Math.max(s.costUsd, s.valueUsd)),
  );

  const xOf = (i: number): number =>
    PL + (series.length <= 1 ? 0 : (i / (series.length - 1)) * innerW);
  const yOf = (v: number): number => PT + innerH * (1 - v / maxVal);

  const costPath = series.map((p, i) => `${i === 0 ? "M" : "L"} ${xOf(i).toFixed(1)} ${yOf(p.costUsd).toFixed(1)}`).join(" ");
  const valuePath = series.map((p, i) => `${i === 0 ? "M" : "L"} ${xOf(i).toFixed(1)} ${yOf(p.valueUsd).toFixed(1)}`).join(" ");

  // Build area between cost and value — greenish where value≥cost, reddish otherwise.
  const buildArea = (filter: "gain" | "loss"): string => {
    const pts: string[] = [];
    for (let i = 0; i < series.length; i++) {
      const p = series[i]!;
      const isGain = p.valueUsd >= p.costUsd;
      if ((filter === "gain" && isGain) || (filter === "loss" && !isGain)) {
        pts.push(`${xOf(i).toFixed(1)} ${yOf(p.valueUsd).toFixed(1)}`);
      }
    }
    if (pts.length < 2) return "";
    const reverseCosts: string[] = [];
    for (let i = series.length - 1; i >= 0; i--) {
      const p = series[i]!;
      const isGain = p.valueUsd >= p.costUsd;
      if ((filter === "gain" && isGain) || (filter === "loss" && !isGain)) {
        reverseCosts.push(`${xOf(i).toFixed(1)} ${yOf(p.costUsd).toFixed(1)}`);
      }
    }
    return `M ${pts.join(" L ")} L ${reverseCosts.join(" L ")} Z`;
  };

  const costLen = 600; // overshoot for dashed draw
  const valueLen = 600;

  return (
    <div style={chartWrap}>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="cost vs value">
        {/* Y grid */}
        {[0, 0.25, 0.5, 0.75, 1].map(t => {
          const y = PT + innerH * (1 - t);
          return (
            <g key={`y-${t}`}>
              <line x1={PL} y1={y} x2={PL + innerW} y2={y} stroke={color.border} strokeDasharray="3 4" />
              <text x={PL - 6} y={y + 3} textAnchor="end" fontSize={font.size.xxs} fill={color.text3} fontFamily={font.mono}>
                {fmtUsd(maxVal * t)}
              </text>
            </g>
          );
        })}

        {/* X labels */}
        {series.map((_, i) => {
          if (i % 2 !== 0 && i !== series.length - 1) return null;
          const x = xOf(i);
          return (
            <text key={`x-${i}`} x={x} y={PT + innerH + 14} textAnchor="middle" fontSize={font.size.xxs} fill={color.text3} fontFamily={font.mono}>
              {monthLabel(i, series.length)}
            </text>
          );
        })}

        {/* Area between lines */}
        <path d={buildArea("gain")} fill={color.success} style={{ animation: `roi-area 900ms ${ENTRY_EASE} both`, animationDelay: "420ms" }} />
        <path d={buildArea("loss")} fill={color.danger} style={{ animation: `roi-area 900ms ${ENTRY_EASE} both`, animationDelay: "420ms" }} />

        {/* Cost line */}
        <path
          d={costPath}
          fill="none"
          stroke={color.danger}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            ["--dash" as string]: String(costLen),
            strokeDasharray: costLen,
            animation: `roi-draw ${LINE_DRAW_MS}ms ${ENTRY_EASE} both`,
            animationDelay: "120ms",
          } as CSSProperties}
        />

        {/* Value line */}
        <path
          d={valuePath}
          fill="none"
          stroke={color.success}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            ["--dash" as string]: String(valueLen),
            strokeDasharray: valueLen,
            animation: `roi-draw ${LINE_DRAW_MS}ms ${ENTRY_EASE} both`,
            animationDelay: "240ms",
          } as CSSProperties}
        />

        {/* End-dots */}
        {series.map((p, i) => (
          <g key={`dots-${i}`}>
            <circle cx={xOf(i)} cy={yOf(p.costUsd)} r={2.4} fill={color.danger} opacity={0.85} />
            <circle cx={xOf(i)} cy={yOf(p.valueUsd)} r={2.4} fill={color.success} opacity={0.85} />
          </g>
        ))}

        <text x={PL + innerW / 2} y={H - 4} textAnchor="middle" fontSize={font.size.xxs} fill={color.text2} fontFamily={font.sans}>
          month →
        </text>
      </svg>
    </div>
  );
}

// ── Table ──────────────────────────────────────────────────────────────

function ROITable({ series }: { series: AgentROIPoint[] }): ReactElement {
  const reversed = [...series].reverse(); // newest first
  return (
    <div style={tableWrap}>
      <div style={tableHeaderStyle}>
        <span style={{ ...cellBaseStyle, flex: "0 0 68px" }}>month</span>
        <span style={{ ...cellBaseStyle, flex: 1, textAlign: "right" }}>cost</span>
        <span style={{ ...cellBaseStyle, flex: "0 0 60px", textAlign: "right" }}>PRs</span>
        <span style={{ ...cellBaseStyle, flex: "0 0 60px", textAlign: "right" }}>bugs</span>
        <span style={{ ...cellBaseStyle, flex: 1, textAlign: "right" }}>value</span>
        <span style={{ ...cellBaseStyle, flex: "0 0 70px", textAlign: "right" }}>ROI %</span>
      </div>
      {reversed.map((p, i) => {
        const roi = p.costUsd > 0 ? ((p.valueUsd / p.costUsd) - 1) * 100 : 0;
        const roiTint = roi >= 0 ? color.success : color.danger;
        return (
          <div key={p.monthIdx} style={{ ...rowStyle, animationDelay: `${Math.min(i * STAGGER_MS, 240)}ms` }}>
            <span style={{ ...cellBaseStyle, flex: "0 0 68px", color: color.text0, fontWeight: font.weight.medium }}>
              {monthLabel(p.monthIdx, series.length)}
            </span>
            <span style={{ ...cellBaseStyle, flex: 1, textAlign: "right", color: color.danger }}>
              {fmtUsd(p.costUsd)}
            </span>
            <span style={{ ...cellBaseStyle, flex: "0 0 60px", textAlign: "right", color: color.text1 }}>
              {p.prsMerged}
            </span>
            <span style={{ ...cellBaseStyle, flex: "0 0 60px", textAlign: "right", color: color.text1 }}>
              {p.bugsFixed}
            </span>
            <span style={{ ...cellBaseStyle, flex: 1, textAlign: "right", color: color.success }}>
              {fmtUsd(p.valueUsd)}
            </span>
            <span style={{ ...cellBaseStyle, flex: "0 0 70px", textAlign: "right", color: roiTint, fontWeight: font.weight.semibold }}>
              {roi >= 0 ? "+" : ""}{roi.toFixed(1)}%
            </span>
          </div>
        );
      })}
    </div>
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
  animation: `roi-enter ${ENTRY_MS}ms ${ENTRY_EASE} both`,
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

const heroGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 2fr 1fr",
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
  animation: `roi-tile 460ms ${ENTRY_EASE} both`,
  minHeight: 108,
};

const heroLabelStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  fontWeight: font.weight.semibold,
  fontFamily: font.mono,
};

const heroSubStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text3,
  fontFamily: font.mono,
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

const chartWrap: CSSProperties = {
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  padding: space[3],
};

const tableWrap: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  overflow: "hidden",
};

const tableHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  padding: `${space[2]}px ${space[3]}px`,
  background: color.bg2,
  borderBottom: `1px solid ${color.border}`,
  fontSize: font.size.xxs,
  color: color.text2,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  fontFamily: font.mono,
  fontWeight: font.weight.semibold,
};

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  padding: `${space[2]}px ${space[3]}px`,
  borderBottom: `1px solid ${color.borderSoft}`,
  animation: `roi-row 440ms ${ENTRY_EASE} both`,
  fontSize: font.size.xs,
};

const cellBaseStyle: CSSProperties = {
  fontFamily: font.mono,
  fontVariantNumeric: "tabular-nums",
};

const insightStyle: CSSProperties = {
  padding: space[4],
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  boxShadow: shadow.xs,
  animation: `roi-tile 460ms ${ENTRY_EASE} both`,
  animationDelay: "120ms",
};

const insightLabelStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  fontWeight: font.weight.semibold,
  fontFamily: font.mono,
};

export const AgentROIView = memo(AgentROIViewImpl);
