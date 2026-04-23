import { memo, useMemo } from "react";
import type { CSSProperties, ReactElement } from "react";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, shadow, space } from "../../../shared/ui/tokens";
import { authorHue, reviewBurden, type ReviewBurdenReport } from "../../../shared/analytics/synth-metrics";

interface Props { ctx: ViewContextValue; }
const ENTRY_MS = 520;
const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const KEYFRAMES = `@keyframes rb-enter{from{opacity:0;transform:scale(.985)}to{opacity:1;transform:scale(1)}} @keyframes rb-rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}} @keyframes rb-bar{from{transform:scaleX(0)}to{transform:scaleX(1)}}`;
const pct = (n: number) => `${Math.round(n * 100)}%`;

function ReviewBurdenViewImpl({ ctx }: Props): ReactElement {
  const report = useMemo<ReviewBurdenReport>(() => reviewBurden(ctx.tree), [ctx.tree]);
  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>
      <header style={headerStyle}><div><div style={titleStyle}>Review Burden · <span style={{ color: color.warn }}>AI PR capacity</span></div><div style={subtitleStyle}>how much review work the team can actually absorb</div></div><div style={refStyle}>human review remains the trust bottleneck</div></header>
      <section style={heroGrid}><Metric label="AI PR share" value={pct(report.aiPrShare)} tint={report.aiPrShare <= 0.45 ? color.success : report.aiPrShare <= 0.65 ? color.warn : color.danger} sub="of weekly PR volume" /><Metric label="review debt" value={`${report.reviewDebtHours.toFixed(1)}h`} tint={report.reviewDebtHours <= 2 ? color.success : report.reviewDebtHours <= 6 ? color.warn : color.danger} sub="over weekly capacity" /><Metric label="overloaded reviewers" value={`${report.overloadedReviewers}`} tint={report.overloadedReviewers === 0 ? color.success : color.danger} sub={`${report.reviewers.length} reviewers`} /><Metric label="risky auto-merge" value={pct(report.riskyAutoMergeRate)} tint={report.riskyAutoMergeRate <= 0.18 ? color.success : color.danger} sub="merge-without-depth risk" /></section>
      <section style={bodyGrid}><div style={panelStyle}><div style={panelHead}><span style={sectionTitle}>Reviewer load</span><span style={mutedMono}>minutes vs capacity</span></div><div style={{ padding: space[4], display: 'grid', gap: space[3] }}>{report.reviewers.map((row, index) => { const tint = row.overloadPct <= 0 ? color.success : row.overloadPct <= 0.25 ? color.warn : color.danger; return <article key={row.reviewer} style={{ ...rowCard, animationDelay: `${index * 18}ms` }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: space[2], alignItems: 'center' }}><div style={{ display: 'flex', alignItems: 'center', gap: space[2] }}><div style={{ width: 26, height: 26, borderRadius: radius.pill, background: `hsl(${authorHue(row.reviewer)} 72% 52% / .16)`, color: `hsl(${authorHue(row.reviewer)} 72% 38%)`, display: 'grid', placeItems: 'center', fontFamily: font.mono, fontSize: font.size.xs, fontWeight: font.weight.semibold }}>{row.reviewer.slice(0,2).toUpperCase()}</div><div><div style={rowName}>{row.reviewer}</div><div style={rowMeta}>{row.aiPrs} AI PR · {row.humanPrs} human PR</div></div></div><span style={chipStyle(tint)}>{row.overloadPct <= 0 ? 'healthy' : row.overloadPct <= 0.25 ? 'tight' : 'overload'}</span></div><div style={rowNums}><span>{row.reviewMinutes}m review</span><span>{row.weeklyCapacityMinutes}m capacity</span><span>{pct(row.deepReviewRate)} deep review</span></div><div style={barTrack}><div style={{ ...barFill, width: `${Math.max(6, Math.min(1.4, row.reviewMinutes / Math.max(1, row.weeklyCapacityMinutes)) * 100)}%`, background: tint }} /></div></article>; })}</div></div><aside style={sidebarStyle}><div style={panelStyle}><div style={panelHead}><span style={sectionTitle}>Operational insight</span></div><div style={{ padding: space[4], display: 'grid', gap: space[3] }}><div style={insightLead}>{report.overloadedReviewers} reviewers are beyond capacity this week.</div><div style={insightText}>AI가 PR 양을 늘리면 review depth가 먼저 줄어듭니다. 이 상태에서 auto-merge 비율이 오르면 trust surface가 무너집니다. high-risk view와 연동해 senior review를 강제하는 게 좋습니다.</div></div></div></aside></section>
    </div>
  );
}
function Metric({ label, value, tint, sub }: { label: string; value: string; tint: string; sub: string }): ReactElement { return <div style={metricCard}><div style={metricLabel}>{label}</div><div style={{ ...metricValue, color: tint }}>{value}</div><div style={metricSub}>{sub}</div></div>; }
export const ReviewBurdenView = memo(ReviewBurdenViewImpl);
const rootStyle: CSSProperties = { width: '100%', height: '100%', overflowY: 'auto', background: color.bg0, color: color.text0, fontFamily: font.sans, padding: `${space[5]}px ${space[6]}px`, boxSizing: 'border-box', display: 'grid', gap: space[4], animation: `rb-enter ${ENTRY_MS}ms ${ENTRY_EASE} both` };
const headerStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: space[4] };
const titleStyle: CSSProperties = { fontSize: font.size.display, fontWeight: font.weight.semibold };
const subtitleStyle: CSSProperties = { marginTop: 4, fontSize: font.size.sm, color: color.text2 };
const refStyle: CSSProperties = { fontSize: font.size.xs, color: color.text2, fontFamily: font.mono, textAlign: 'right' };
const heroGrid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: space[3] };
const metricCard: CSSProperties = { border: `1px solid ${color.border}`, borderRadius: radius.lg, background: color.bg1, boxShadow: shadow.sm, padding: space[4], display: 'grid', gap: space[2] };
const metricLabel: CSSProperties = { fontSize: font.size.xs, color: color.text2, fontFamily: font.mono, textTransform: 'uppercase' };
const metricValue: CSSProperties = { fontSize: 30, lineHeight: 1, fontWeight: font.weight.semibold, fontVariantNumeric: 'tabular-nums' };
const metricSub: CSSProperties = { fontSize: font.size.sm, color: color.text2 };
const bodyGrid: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(0, 1.55fr) minmax(280px, .8fr)', gap: space[4], alignItems: 'start' };
const panelStyle: CSSProperties = { border: `1px solid ${color.border}`, borderRadius: radius.lg, background: color.bg1, boxShadow: shadow.sm, overflow: 'hidden' };
const panelHead: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: space[2], padding: `${space[3]}px ${space[4]}px`, borderBottom: `1px solid ${color.borderSoft}` };
const sectionTitle: CSSProperties = { fontSize: font.size.md, fontWeight: font.weight.semibold };
const mutedMono: CSSProperties = { fontSize: font.size.xs, color: color.text2, fontFamily: font.mono };
const rowCard: CSSProperties = { border: `1px solid ${color.border}`, borderRadius: radius.md, padding: space[3], display: 'grid', gap: space[2], animation: `rb-rise ${ENTRY_MS}ms ${ENTRY_EASE} both` };
const rowName: CSSProperties = { fontSize: font.size.lg, fontWeight: font.weight.semibold };
const rowMeta: CSSProperties = { marginTop: 2, fontSize: font.size.xs, color: color.text2, fontFamily: font.mono };
const rowNums: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: space[2], fontSize: font.size.xs, color: color.text1, fontFamily: font.mono };
const barTrack: CSSProperties = { width: '100%', height: 10, borderRadius: radius.pill, background: color.bg3, overflow: 'hidden' };
const barFill: CSSProperties = { height: '100%', transformOrigin: 'left center', animation: `rb-bar 560ms ${ENTRY_EASE} both` };
const sidebarStyle: CSSProperties = { display: 'grid', gap: space[3] };
const insightLead: CSSProperties = { fontSize: font.size.lg, fontWeight: font.weight.semibold };
const insightText: CSSProperties = { fontSize: font.size.sm, color: color.text1, lineHeight: 1.65 };
function chipStyle(tint: string): CSSProperties { return { display: 'inline-flex', alignItems: 'center', padding: `4px ${space[2]}px`, borderRadius: radius.pill, background: `${tint}16`, color: tint, fontSize: font.size.xs, fontFamily: font.mono, fontWeight: font.weight.semibold, textTransform: 'uppercase' }; }
