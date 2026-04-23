import { memo, useMemo } from "react";
import type { CSSProperties, ReactElement } from "react";
import type { Entity } from "@quanta/canvas-engine";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, shadow, space } from "../../../shared/ui/tokens";
import { messageCodeMismatch, type MessageCodeMismatchReport } from "../../../shared/analytics/synth-metrics";

export interface MessageCodeMismatchViewProps { ctx: ViewContextValue; entity?: Entity; empty?: boolean; }
const ENTRY_MS = 520;
const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const KEYFRAMES = `@keyframes mm-enter{from{opacity:0;transform:scale(.985)}to{opacity:1;transform:scale(1)}} @keyframes mm-rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}} @keyframes mm-bar{from{transform:scaleX(0)}to{transform:scaleX(1)}}`;
function pct(n: number): string { return `${Math.round(n * 100)}%`; }
function verdictTint(v: MessageCodeMismatchReport['verdict']): string { return v === 'aligned' ? color.success : v === 'drifting' ? color.warn : color.danger; }

function MessageCodeMismatchViewImpl({ entity, empty }: MessageCodeMismatchViewProps): ReactElement {
  const report = useMemo<MessageCodeMismatchReport | null>(() => entity ? messageCodeMismatch(entity) : null, [entity]);
  if (empty || !report) return <div style={emptyStyle}><style>{KEYFRAMES}</style>파일을 선택하면 메시지와 코드의 불일치를 분석합니다.</div>;
  const tint = verdictTint(report.verdict);
  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>
      <header style={headerStyle}><div><div style={titleStyle}>Message ↔ Code · <span style={{ color: tint }}>{report.fileName}</span></div><div style={subtitleStyle}>claim alignment across scope / behavior / test / risk / ownership</div></div><div style={refStyle}>review trust surface</div></header>
      <section style={heroGrid}><Metric label="summary fit" value={pct(report.summaryFit)} tint={tint} sub={report.verdict} /><Metric label="mismatch rows" value={`${report.rows.filter(r => r.mismatch > 0.4).length}`} tint={report.rows.filter(r => r.mismatch > 0.4).length === 0 ? color.success : color.danger} sub={`${report.rows.length} statements`} /></section>
      <section style={bodyGrid}><div style={panelStyle}><div style={panelHead}><span style={sectionTitle}>Statement alignment</span><span style={mutedMono}>higher is better</span></div><div style={{ padding: space[4], display: 'grid', gap: space[3] }}>{report.rows.map((row, index) => <article key={row.id} style={{ ...rowCard, animationDelay: `${index * 18}ms` }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: space[2] }}><div><div style={rowTitle}>{row.statement}</div><div style={rowMeta}>{row.kind} · {row.rationale}</div></div><span style={chipStyle(row.alignment >= 0.72 ? color.success : row.alignment >= 0.5 ? color.warn : color.danger)}>{pct(row.alignment)}</span></div><div style={dualTrack}><div style={{ ...dualBar, width: `${Math.max(6, row.alignment * 100)}%`, background: color.success }} /><div style={{ ...dualBar, width: `${Math.max(6, row.mismatch * 100)}%`, background: color.danger, opacity: 0.55 }} /></div></article>)}</div></div><aside style={sidebarStyle}><div style={panelStyle}><div style={panelHead}><span style={sectionTitle}>Reviewer guidance</span></div><div style={{ padding: space[4], display: 'grid', gap: space[3] }}><div style={insightLead}>{report.verdict === 'aligned' ? '설명과 코드가 거의 일치합니다.' : report.verdict === 'drifting' ? '설명은 맞지만 scope 또는 risk 표현이 흔들립니다.' : '설명과 코드가 다릅니다. merge 전 재서술이 필요합니다.'}</div><div style={insightText}>AI PR은 코드보다 설명이 더 그럴듯한 경우가 많습니다. summary fit이 낮으면 diff만 보지 말고 PR description / commit message도 다시 쓰게 해야 합니다.</div></div></div></aside></section>
    </div>
  );
}
function Metric({ label, value, tint, sub }: { label: string; value: string; tint: string; sub: string }): ReactElement { return <div style={metricCard}><div style={metricLabel}>{label}</div><div style={{ ...metricValue, color: tint }}>{value}</div><div style={metricSub}>{sub}</div></div>; }
export const MessageCodeMismatchView = memo(MessageCodeMismatchViewImpl);
const rootStyle: CSSProperties = { width: '100%', height: '100%', overflowY: 'auto', background: color.bg0, color: color.text0, fontFamily: font.sans, padding: `${space[5]}px ${space[6]}px`, boxSizing: 'border-box', display: 'grid', gap: space[4], animation: `mm-enter ${ENTRY_MS}ms ${ENTRY_EASE} both` };
const emptyStyle: CSSProperties = { width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: color.text3, fontFamily: font.sans };
const headerStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: space[4] };
const titleStyle: CSSProperties = { fontSize: font.size.display, fontWeight: font.weight.semibold };
const subtitleStyle: CSSProperties = { marginTop: 4, fontSize: font.size.sm, color: color.text2 };
const refStyle: CSSProperties = { fontSize: font.size.xs, color: color.text2, fontFamily: font.mono, textAlign: 'right' };
const heroGrid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: space[3] };
const metricCard: CSSProperties = { border: `1px solid ${color.border}`, borderRadius: radius.lg, background: color.bg1, boxShadow: shadow.sm, padding: space[4], display: 'grid', gap: space[2] };
const metricLabel: CSSProperties = { fontSize: font.size.xs, color: color.text2, fontFamily: font.mono, textTransform: 'uppercase' };
const metricValue: CSSProperties = { fontSize: 30, lineHeight: 1, fontWeight: font.weight.semibold, fontVariantNumeric: 'tabular-nums' };
const metricSub: CSSProperties = { fontSize: font.size.sm, color: color.text2 };
const bodyGrid: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(0, 1.55fr) minmax(280px, .8fr)', gap: space[4], alignItems: 'start' };
const panelStyle: CSSProperties = { border: `1px solid ${color.border}`, borderRadius: radius.lg, background: color.bg1, boxShadow: shadow.sm, overflow: 'hidden' };
const panelHead: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: space[2], padding: `${space[3]}px ${space[4]}px`, borderBottom: `1px solid ${color.borderSoft}` };
const sectionTitle: CSSProperties = { fontSize: font.size.md, fontWeight: font.weight.semibold };
const mutedMono: CSSProperties = { fontSize: font.size.xs, color: color.text2, fontFamily: font.mono };
const rowCard: CSSProperties = { border: `1px solid ${color.border}`, borderRadius: radius.md, padding: space[3], display: 'grid', gap: space[2], animation: `mm-rise ${ENTRY_MS}ms ${ENTRY_EASE} both` };
const rowTitle: CSSProperties = { fontSize: font.size.lg, fontWeight: font.weight.semibold };
const rowMeta: CSSProperties = { marginTop: 2, fontSize: font.size.xs, color: color.text2, fontFamily: font.mono };
const dualTrack: CSSProperties = { display: 'flex', width: '100%', height: 10, background: color.bg3, borderRadius: radius.pill, overflow: 'hidden' };
const dualBar: CSSProperties = { height: '100%', animation: `mm-bar 560ms ${ENTRY_EASE} both`, transformOrigin: 'left center' };
const sidebarStyle: CSSProperties = { display: 'grid', gap: space[3] };
const insightLead: CSSProperties = { fontSize: font.size.lg, fontWeight: font.weight.semibold };
const insightText: CSSProperties = { fontSize: font.size.sm, color: color.text1, lineHeight: 1.65 };
function chipStyle(tint: string): CSSProperties { return { display: 'inline-flex', alignItems: 'center', padding: `4px ${space[2]}px`, borderRadius: radius.pill, background: `${tint}16`, color: tint, fontSize: font.size.xs, fontFamily: font.mono, fontWeight: font.weight.semibold, textTransform: 'uppercase' }; }
