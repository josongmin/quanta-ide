import { memo, useMemo } from "react";
import type { CSSProperties, ReactElement } from "react";
import type { Entity } from "@quanta/canvas-engine";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, shadow, space } from "../../../shared/ui/tokens";
import { agentabilityScore, type AIModel, type AgentabilityReport } from "../../../shared/analytics/synth-metrics";

export interface AgentabilityViewProps { ctx: ViewContextValue; entity?: Entity; empty?: boolean; }
const ENTRY_MS = 520;
const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const KEYFRAMES = `@keyframes af-enter{from{opacity:0;transform:scale(.985)}to{opacity:1;transform:scale(1)}} @keyframes af-rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}} @keyframes af-bar{from{transform:scaleX(0)}to{transform:scaleX(1)}}`;
const MODEL_LABEL: Record<AIModel, string> = { "claude-opus-4-7": "Claude Opus 4.7", "claude-sonnet-4-6": "Claude Sonnet 4.6", "gpt-5": "GPT-5", "gpt-5-mini": "GPT-5 mini", "gemini-2.5-pro": "Gemini 2.5 Pro" };
function verdictTint(v: AgentabilityReport['verdict']): string { return v === 'ai-first' ? color.success : v === 'chunk-first' ? color.warn : color.danger; }
function verdictCopy(v: AgentabilityReport['verdict']): string { return v === 'ai-first' ? 'AI-first' : v === 'chunk-first' ? 'Chunk-first' : 'Human-first'; }
function pct(n: number): string { return `${Math.round(n * 100)}%`; }

function AgentabilityViewImpl({ ctx, entity, empty }: AgentabilityViewProps): ReactElement {
  const report = useMemo<AgentabilityReport | null>(() => (entity && ctx.tree) ? agentabilityScore(entity, ctx.tree, ctx.graph?.fileEdges) : null, [ctx.graph, ctx.tree, entity]);
  if (empty || !report) return <div style={emptyStyle}><style>{KEYFRAMES}</style>파일을 선택하면 agentability score를 계산합니다.</div>;
  const tint = verdictTint(report.verdict);
  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>
      <header style={headerStyle}><div><div style={titleStyle}>Agentability · <span style={{ color: tint }}>{report.fileName}</span></div><div style={subtitleStyle}>delegate-or-not control plane for AI-native IDE</div></div><div style={refStyle}>METR task horizons · repository-specific routing</div></header>
      <section style={heroGrid}><div style={{ ...scoreCard, borderColor: `${tint}44` }}><div style={metricLabel}>agentability score</div><div style={{ ...scoreValue, color: tint }}>{report.score}</div><div style={scoreFoot}><span style={chipStyle(tint)}>{verdictCopy(report.verdict)}</span><span style={mutedMono}>{pct(report.expectedSuccess)} expected success</span></div></div><Metric label="model" value={MODEL_LABEL[report.recommendedModel]} sub="recommended" tint={color.text0} /><Metric label="chunks" value={`${report.recommendedChunks}`} sub="suggested split" tint={report.recommendedChunks <= 2 ? color.success : report.recommendedChunks <= 4 ? color.warn : color.danger} /></section>
      <section style={bodyGrid}>
        <div style={panelStyle}><div style={panelHead}><span style={sectionTitle}>Factor breakdown</span><span style={mutedMono}>weighted composite</span></div><div style={{ padding: space[4], display: 'grid', gap: space[3] }}>{report.factors.map((factor, index) => <article key={factor.id} style={{ ...factorCard, animationDelay: `${index * 18}ms` }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: space[2] }}><div><div style={factorTitle}>{factor.label}</div><div style={factorMeta}>{factor.explanation}</div></div><div style={{ textAlign: 'right' }}><div style={factorNum}>{pct(factor.score)}</div><div style={factorMeta}>w {Math.round(factor.weight * 100)}</div></div></div><div style={barTrack}><div style={{ ...barFill, width: `${Math.max(6, factor.score * 100)}%`, background: factor.score >= 0.72 ? color.success : factor.score >= 0.5 ? color.warn : color.danger }} /></div></article>)}</div></div>
        <aside style={sidebarStyle}><div style={panelStyle}><div style={panelHead}><span style={sectionTitle}>Routing recommendation</span></div><div style={{ padding: space[4], display: 'grid', gap: space[3] }}><div style={insightLead}>{verdictCopy(report.verdict)} · {MODEL_LABEL[report.recommendedModel]}</div><div style={insightText}>{report.verdict === 'ai-first' ? 'verification surface가 충분하고 blind spot이 낮습니다. agent에게 바로 맡겨도 좋습니다.' : report.verdict === 'chunk-first' ? '한 번에 맡기기보다는 2~3 chunk로 쪼개는 편이 안전합니다.' : 'context load와 blind spot이 큽니다. 초안만 AI에게 맡기고 핵심 판단은 사람이 직접 하는 편이 낫습니다.'}</div></div></div></aside>
      </section>
    </div>
  );
}
function Metric({ label, value, sub, tint }: { label: string; value: string; sub: string; tint: string }): ReactElement { return <div style={metricCard}><div style={metricLabel}>{label}</div><div style={{ ...metricValue, color: tint }}>{value}</div><div style={metricSub}>{sub}</div></div>; }
export const AgentabilityView = memo(AgentabilityViewImpl);
const rootStyle: CSSProperties = { width: '100%', height: '100%', overflowY: 'auto', background: color.bg0, color: color.text0, fontFamily: font.sans, padding: `${space[5]}px ${space[6]}px`, boxSizing: 'border-box', display: 'grid', gap: space[4], animation: `af-enter ${ENTRY_MS}ms ${ENTRY_EASE} both` };
const emptyStyle: CSSProperties = { width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: color.text3, fontFamily: font.sans };
const headerStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: space[4] };
const titleStyle: CSSProperties = { fontSize: font.size.display, fontWeight: font.weight.semibold };
const subtitleStyle: CSSProperties = { marginTop: 4, fontSize: font.size.sm, color: color.text2 };
const refStyle: CSSProperties = { fontSize: font.size.xs, color: color.text2, fontFamily: font.mono, textAlign: 'right' };
const heroGrid: CSSProperties = { display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: space[3] };
const scoreCard: CSSProperties = { border: `1px solid ${color.border}`, borderRadius: radius.lg, background: color.bg1, boxShadow: shadow.sm, padding: space[4], display: 'grid', gap: space[2] };
const metricCard: CSSProperties = { border: `1px solid ${color.border}`, borderRadius: radius.lg, background: color.bg1, boxShadow: shadow.sm, padding: space[4], display: 'grid', gap: space[2] };
const metricLabel: CSSProperties = { fontSize: font.size.xs, color: color.text2, fontFamily: font.mono, textTransform: 'uppercase' };
const scoreValue: CSSProperties = { fontSize: 48, lineHeight: 1, fontWeight: font.weight.semibold, fontVariantNumeric: 'tabular-nums' };
const scoreFoot: CSSProperties = { display: 'flex', alignItems: 'center', gap: space[2], flexWrap: 'wrap' };
const metricValue: CSSProperties = { fontSize: font.size.xl, lineHeight: 1.2, fontWeight: font.weight.semibold };
const metricSub: CSSProperties = { fontSize: font.size.sm, color: color.text2 };
const bodyGrid: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(0, 1.55fr) minmax(280px, .8fr)', gap: space[4], alignItems: 'start' };
const panelStyle: CSSProperties = { border: `1px solid ${color.border}`, borderRadius: radius.lg, background: color.bg1, boxShadow: shadow.sm, overflow: 'hidden' };
const panelHead: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: space[2], padding: `${space[3]}px ${space[4]}px`, borderBottom: `1px solid ${color.borderSoft}` };
const sectionTitle: CSSProperties = { fontSize: font.size.md, fontWeight: font.weight.semibold };
const mutedMono: CSSProperties = { fontSize: font.size.xs, color: color.text2, fontFamily: font.mono };
const factorCard: CSSProperties = { border: `1px solid ${color.border}`, borderRadius: radius.md, padding: space[3], display: 'grid', gap: space[2], animation: `af-rise ${ENTRY_MS}ms ${ENTRY_EASE} both` };
const factorTitle: CSSProperties = { fontSize: font.size.lg, fontWeight: font.weight.semibold };
const factorMeta: CSSProperties = { marginTop: 2, fontSize: font.size.xs, color: color.text2, fontFamily: font.mono };
const factorNum: CSSProperties = { fontSize: font.size.lg, fontWeight: font.weight.semibold, fontFamily: font.mono };
const barTrack: CSSProperties = { width: '100%', height: 8, borderRadius: radius.pill, background: color.bg3, overflow: 'hidden' };
const barFill: CSSProperties = { height: '100%', transformOrigin: 'left center', animation: `af-bar 560ms ${ENTRY_EASE} both` };
const sidebarStyle: CSSProperties = { display: 'grid', gap: space[3] };
const insightLead: CSSProperties = { fontSize: font.size.lg, fontWeight: font.weight.semibold };
const insightText: CSSProperties = { fontSize: font.size.sm, color: color.text1, lineHeight: 1.65 };
function chipStyle(tint: string): CSSProperties { return { display: 'inline-flex', alignItems: 'center', padding: `4px ${space[2]}px`, borderRadius: radius.pill, background: `${tint}16`, color: tint, fontSize: font.size.xs, fontFamily: font.mono, fontWeight: font.weight.semibold, textTransform: 'uppercase' }; }
