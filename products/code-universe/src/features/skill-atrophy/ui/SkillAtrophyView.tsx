import { memo, useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactElement } from "react";

import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, shadow, space } from "../../../shared/ui/tokens";
import {
  authorHue,
  skillAtrophyTrends,
  type DeveloperSkillTrend,
} from "../../../shared/analytics/synth-metrics";

interface Props {
  ctx: ViewContextValue;
}

const ENTRY_MS = 520;
const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const STAGGER_MS = 18;
const COUNTER_MS = 640;
const CHART_W = 236;
const CHART_H = 74;
const PAD = 8;

const KEYFRAMES = `
@keyframes sa-enter { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
@keyframes sa-card { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes sa-bar { from { transform: scaleX(0); } to { transform: scaleX(1); } }
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

function verdictTint(verdict: DeveloperSkillTrend["verdict"]): string {
  if (verdict === "declining") return color.danger;
  if (verdict === "at-risk") return color.warn;
  return color.success;
}

function sparkline(values: readonly number[], max: number): string {
  if (values.length === 0) return "";
  return values
    .map((value, index) => {
      const x = PAD + (index / Math.max(1, values.length - 1)) * (CHART_W - PAD * 2);
      const y = CHART_H - PAD - (value / Math.max(1, max)) * (CHART_H - PAD * 2);
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function SkillAtrophyViewImpl({ ctx }: Props): ReactElement | null {
  const data = useMemo(() => skillAtrophyTrends(), [ctx.tree]);
  const stats = useMemo(() => {
    const healthy = data.filter(row => row.verdict === "healthy").length;
    const atRisk = data.filter(row => row.verdict === "at-risk").length;
    const declining = data.filter(row => row.verdict === "declining").length;
    const avg = data.reduce((sum, row) => sum + row.atrophyIndex, 0) / Math.max(1, data.length);
    return { healthy, atRisk, declining, avg };
  }, [data]);

  const healthyCounter = useCounter(stats.healthy, COUNTER_MS);
  const riskCounter = useCounter(stats.atRisk, COUNTER_MS);
  const decliningCounter = useCounter(stats.declining, COUNTER_MS);
  const avgCounter = useCounter(stats.avg * 100, COUNTER_MS);

  if (data.length === 0) {
    return (
      <div style={rootStyle}>
        <style>{KEYFRAMES}</style>
        <div style={emptyStyle}>팀 skill trend 데이터가 없습니다.</div>
      </div>
    );
  }

  const maxHuman = Math.max(1, ...data.flatMap(row => row.humanOnlyLoc12w));

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>
      <header style={headerStyle}>
        <div>
          <div style={titleStyle}>
            Skill Atrophy · <span style={{ color: color.warn }}>AI reliance trend</span>
          </div>
          <div style={subtitleStyle}>12주간 AI ratio 상승 × human-only LoC 하락 composite</div>
        </div>
        <div style={refStyle}>
          Microsoft Research / CMU 2025<br />
          Stanford HCI · ACM Queue 2024
        </div>
      </header>

      <section style={heroGrid}>
        <MetricTile label="healthy" value={healthyCounter} tint={color.success} />
        <MetricTile label="at-risk" value={riskCounter} tint={color.warn} />
        <MetricTile label="declining" value={decliningCounter} tint={color.danger} />
        <div style={heroPanel}>
          <div style={metricLabel}>team atrophy index</div>
          <div style={{ ...metricValue, color: color.text0 }}>{avgCounter.toFixed(1)}%</div>
          <div style={stackTrack}>
            <div style={{ ...stackFill(stats.declining / data.length, color.danger), borderRadius: `${radius.pill}px 0 0 ${radius.pill}px` }} />
            <div style={{ ...stackFill(stats.atRisk / data.length, color.warn) }} />
            <div style={{ ...stackFill(stats.healthy / data.length, color.success), borderRadius: `0 ${radius.pill}px ${radius.pill}px 0` }} />
          </div>
          <div style={legendRow}>
            <LegendDot tint={color.danger} label="declining" />
            <LegendDot tint={color.warn} label="at-risk" />
            <LegendDot tint={color.success} label="healthy" />
          </div>
        </div>
      </section>

      <section style={cardGrid}>
        {data.map((row, index) => {
          const tint = verdictTint(row.verdict);
          const aiPath = sparkline(row.aiAssistedRatio12w, 1);
          const humanPath = sparkline(row.humanOnlyLoc12w, maxHuman);
          return (
            <article key={row.author} style={{ ...devCard, animationDelay: `${index * STAGGER_MS}ms` }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: space[2], alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: space[2], minWidth: 0 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: radius.pill,
                      background: `hsl(${authorHue(row.author)} 72% 52% / 0.16)`,
                      color: `hsl(${authorHue(row.author)} 72% 38%)`,
                      display: "grid",
                      placeItems: "center",
                      fontFamily: font.mono,
                      fontSize: font.size.sm,
                      fontWeight: font.weight.semibold,
                    }}
                  >
                    {row.author.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div style={devName}>{row.author}</div>
                    <div style={devMeta}>12w trend</div>
                  </div>
                </div>
                <span style={chipStyle(tint)}>{row.verdict}</span>
              </div>

              <svg width={CHART_W} height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`} role="img" aria-label={`${row.author} trend`}>
                {[0.25, 0.5, 0.75].map(t => {
                  const y = CHART_H - PAD - t * (CHART_H - PAD * 2);
                  return <line key={t} x1={PAD} y1={y} x2={CHART_W - PAD} y2={y} stroke={color.border} strokeDasharray="3 4" />;
                })}
                <path d={humanPath} fill="none" stroke={color.success} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
                <path d={aiPath} fill="none" stroke={color.danger} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
              </svg>

              <div style={legendRow}>
                <LegendDot tint={color.danger} label={`AI ${(row.aiAssistedRatio12w.at(-1)! * 100).toFixed(0)}%`} />
                <LegendDot tint={color.success} label={`Human ${Math.round(row.humanOnlyLoc12w.at(-1)!)} LoC`} />
              </div>

              <div>
                <div style={driverHead}>
                  <span>atrophy index</span>
                  <span style={{ color: tint }}>{Math.round(row.atrophyIndex * 100)}%</span>
                </div>
                <div style={barTrack}>
                  <div style={{ ...barFill, width: `${Math.max(6, row.atrophyIndex * 100)}%`, background: tint }} />
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <section style={insightCard}>
        <div style={sectionTitle}>Team guidance</div>
        <div style={insightText}>
          {stats.declining}명은 인간 단독 산출이 줄고 AI 비율이 상승 중입니다. “AI-free Friday”,
          페어 리팩터 세션, 리뷰 시 reasoning 설명 의무화 같은 개입을 검토하세요.
        </div>
      </section>
    </div>
  );
}

function MetricTile({ label, value, tint }: { label: string; value: number; tint: string }): ReactElement {
  return (
    <div style={heroPanel}>
      <div style={metricLabel}>{label}</div>
      <div style={{ ...metricValue, color: tint }}>{Math.round(value)}</div>
      <div style={metricSub}>team members</div>
    </div>
  );
}

function LegendDot({ tint, label }: { tint: string; label: string }): ReactElement {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: font.size.xs, color: color.text2, fontFamily: font.mono }}>
      <span style={{ width: 8, height: 8, borderRadius: radius.pill, background: tint }} />
      {label}
    </span>
  );
}

export const SkillAtrophyView = memo(SkillAtrophyViewImpl);

const rootStyle: CSSProperties = { width: "100%", height: "100%", overflowY: "auto", background: color.bg0, color: color.text0, fontFamily: font.sans, padding: `${space[5]}px ${space[6]}px`, boxSizing: "border-box", display: "grid", gap: space[4], animation: `sa-enter ${ENTRY_MS}ms ${ENTRY_EASE} both` };
const headerStyle: CSSProperties = { display: "flex", justifyContent: "space-between", gap: space[4], alignItems: "flex-start" };
const titleStyle: CSSProperties = { fontSize: font.size.display, fontWeight: font.weight.semibold };
const subtitleStyle: CSSProperties = { marginTop: 4, color: color.text2, fontSize: font.size.sm };
const refStyle: CSSProperties = { textAlign: "right", color: color.text2, fontSize: font.size.xs, fontFamily: font.mono, lineHeight: 1.5 };
const heroGrid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: space[3] };
const heroPanel: CSSProperties = { border: `1px solid ${color.border}`, borderRadius: radius.lg, background: color.bg1, boxShadow: shadow.sm, padding: space[4], display: "grid", gap: space[2] };
const metricLabel: CSSProperties = { fontSize: font.size.xs, color: color.text2, textTransform: "uppercase", letterSpacing: font.letter.wide, fontFamily: font.mono };
const metricValue: CSSProperties = { fontSize: 30, lineHeight: 1, fontWeight: font.weight.semibold };
const metricSub: CSSProperties = { fontSize: font.size.sm, color: color.text2 };
const stackTrack: CSSProperties = { display: "flex", width: "100%", height: 12, borderRadius: radius.pill, overflow: "hidden", background: color.bg3, marginTop: 2 };
const legendRow: CSSProperties = { display: "flex", flexWrap: "wrap", gap: space[2] };
const cardGrid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: space[3] };
const devCard: CSSProperties = { border: `1px solid ${color.border}`, borderRadius: radius.lg, background: color.bg1, boxShadow: shadow.sm, padding: space[4], display: "grid", gap: space[3], animation: `sa-card ${ENTRY_MS}ms ${ENTRY_EASE} both` };
const devName: CSSProperties = { fontSize: font.size.md, fontWeight: font.weight.semibold };
const devMeta: CSSProperties = { marginTop: 2, fontSize: font.size.xs, color: color.text2, fontFamily: font.mono };
const driverHead: CSSProperties = { display: "flex", justifyContent: "space-between", gap: space[2], fontSize: font.size.xs, color: color.text2, fontFamily: font.mono, marginBottom: 4 };
const barTrack: CSSProperties = { width: "100%", height: 8, borderRadius: radius.pill, background: color.bg3, overflow: "hidden" };
const barFill: CSSProperties = { height: "100%", transformOrigin: "left center", animation: `sa-bar 540ms ${ENTRY_EASE} both` };
const insightCard: CSSProperties = { border: `1px solid ${color.border}`, borderRadius: radius.lg, background: color.bg1, boxShadow: shadow.sm, padding: space[4], display: "grid", gap: space[2] };
const sectionTitle: CSSProperties = { fontSize: font.size.lg, fontWeight: font.weight.semibold };
const insightText: CSSProperties = { fontSize: font.size.sm, lineHeight: 1.6, color: color.text1 };
const emptyStyle: CSSProperties = { width: "100%", height: "100%", display: "grid", placeItems: "center", color: color.text3, fontSize: font.size.md };
function chipStyle(tint: string): CSSProperties { return { display: "inline-flex", alignItems: "center", padding: `4px ${space[2]}px`, borderRadius: radius.pill, background: `${tint}16`, color: tint, fontFamily: font.mono, fontSize: font.size.xs, fontWeight: font.weight.semibold, textTransform: "uppercase" }; }
function stackFill(frac: number, tint: string): CSSProperties { return { width: `${Math.max(0, frac) * 100}%`, background: tint, animation: `sa-bar 540ms ${ENTRY_EASE} both`, transformOrigin: "left center" }; }
