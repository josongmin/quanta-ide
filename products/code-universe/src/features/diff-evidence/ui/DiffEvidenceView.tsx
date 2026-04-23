import { memo, useMemo } from "react";
import type { CSSProperties, ReactElement } from "react";
import type { Entity } from "@quanta/canvas-engine";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, shadow, space } from "../../../shared/ui/tokens";
import { diffEvidenceMap, type DiffEvidenceHunk, type DiffEvidenceReport } from "../../../shared/analytics/synth-metrics";

export interface DiffEvidenceViewProps { ctx: ViewContextValue; entity?: Entity; empty?: boolean; }
const ENTRY_MS = 520;
const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const KEYFRAMES = `@keyframes de-enter{from{opacity:0;transform:scale(.985)}to{opacity:1;transform:scale(1)}} @keyframes de-rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}} @keyframes de-bar{from{transform:scaleX(0)}to{transform:scaleX(1)}}`;
const KIND_TINT: Record<DiffEvidenceHunk['evidence'][number]['kind'], string> = { test: color.success, log: color.accent, callsite: "#7e4ed6", spec: color.warn, type: color.text1 };
const pct = (n: number) => `${Math.round(n * 100)}%`;

function DiffEvidenceViewImpl({ entity, empty }: DiffEvidenceViewProps): ReactElement {
  const report = useMemo<DiffEvidenceReport | null>(() => entity ? diffEvidenceMap(entity) : null, [entity]);
  if (empty || !report) return <div style={emptyStyle}><style>{KEYFRAMES}</style>파일을 선택하면 diff hunk별 증거 연결을 보여줍니다.</div>;
  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>
      <header style={headerStyle}><div><div style={titleStyle}>Diff Evidence · <span style={{ color: color.accent }}>{report.fileName}</span></div><div style={subtitleStyle}>evidence-linked diff review · hunk-by-hunk support</div></div><div style={refStyle}>traceability-first AI review surface</div></header>
      <section style={heroGrid}><Metric label="coverage" value={pct(report.overallCoverage)} tint={report.overallCoverage >= 0.72 ? color.success : report.overallCoverage >= 0.5 ? color.warn : color.danger} sub="average support score" /><Metric label="unsupported hunks" value={`${report.unsupportedHunks}`} tint={report.unsupportedHunks === 0 ? color.success : color.danger} sub={`${report.hunks.length} total hunks`} /></section>
      <section style={bodyGrid}>
        <div style={panelStyle}>
          <div style={panelHead}><span style={sectionTitle}>Hunk support matrix</span><span style={mutedMono}>test / spec / trace / type / caller</span></div>
          <div style={{ padding: space[4], display: "grid", gap: space[3] }}>
            {report.hunks.map((hunk, index) => <article key={hunk.id} style={{ ...hunkCard, animationDelay: `${index * 18}ms` }}><div style={{ display: "flex", justifyContent: "space-between", gap: space[3], alignItems: "flex-start" }}><div><div style={hunkTitle}>{hunk.title}</div><div style={hunkMeta}>L{hunk.startLine}–{hunk.endLine}</div></div><span style={chipStyle(hunk.supportScore >= 0.72 ? color.success : hunk.supportScore >= 0.5 ? color.warn : color.danger)}>{pct(hunk.supportScore)}</span></div><div style={barTrack}><div style={{ ...barFill, width: `${Math.max(6, hunk.supportScore * 100)}%`, background: hunk.supportScore >= 0.72 ? color.success : hunk.supportScore >= 0.5 ? color.warn : color.danger }} /></div><div style={evidenceGrid}>{hunk.evidence.map(ev => <div key={`${hunk.id}:${ev.kind}:${ev.label}`} style={evidenceCard}><span style={evidenceKind(KIND_TINT[ev.kind])}>{ev.kind}</span><span style={evidenceLabel}>{ev.label}</span><span style={evidenceSource}>{ev.source}</span><span style={evidenceStrength}>{pct(ev.strength)}</span></div>)}</div>{hunk.unsupportedClaims > 0 && <div style={warningText}>{hunk.unsupportedClaims} unsupported claim(s) — reviewer attention required</div>}</article>)}
          </div>
        </div>
        <aside style={sidebarStyle}><div style={panelStyle}><div style={panelHead}><span style={sectionTitle}>Review guidance</span></div><div style={{ padding: space[4], display: "grid", gap: space[3] }}><div style={insightLead}>Evidence-linked diff should be the default review surface.</div><div style={insightText}>테스트, 타입, trace, caller, spec 중 무엇이 실제 근거인지 hunk 옆에서 바로 보여줘야 리뷰 시간이 줄고 잘못된 자동 PR merge를 막을 수 있습니다.</div></div></div></aside>
      </section>
    </div>
  );
}
function Metric({ label, value, tint, sub }: { label: string; value: string; tint: string; sub: string }): ReactElement { return <div style={metricCard}><div style={metricLabel}>{label}</div><div style={{ ...metricValue, color: tint }}>{value}</div><div style={metricSub}>{sub}</div></div>; }
export const DiffEvidenceView = memo(DiffEvidenceViewImpl);
const rootStyle: CSSProperties = { width: "100%", height: "100%", overflowY: "auto", background: color.bg0, color: color.text0, fontFamily: font.sans, padding: `${space[5]}px ${space[6]}px`, boxSizing: "border-box", display: "grid", gap: space[4], animation: `de-enter ${ENTRY_MS}ms ${ENTRY_EASE} both` };
const emptyStyle: CSSProperties = { width: "100%", height: "100%", display: "grid", placeItems: "center", color: color.text3, fontFamily: font.sans };
const headerStyle: CSSProperties = { display: "flex", justifyContent: "space-between", gap: space[4] };
const titleStyle: CSSProperties = { fontSize: font.size.display, fontWeight: font.weight.semibold };
const subtitleStyle: CSSProperties = { marginTop: 4, fontSize: font.size.sm, color: color.text2 };
const refStyle: CSSProperties = { fontSize: font.size.xs, color: color.text2, fontFamily: font.mono, textAlign: "right" };
const heroGrid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: space[3] };
const metricCard: CSSProperties = { border: `1px solid ${color.border}`, borderRadius: radius.lg, background: color.bg1, boxShadow: shadow.sm, padding: space[4], display: "grid", gap: space[2] };
const metricLabel: CSSProperties = { fontSize: font.size.xs, color: color.text2, fontFamily: font.mono, textTransform: "uppercase" };
const metricValue: CSSProperties = { fontSize: 30, lineHeight: 1, fontWeight: font.weight.semibold, fontVariantNumeric: "tabular-nums" };
const metricSub: CSSProperties = { fontSize: font.size.sm, color: color.text2 };
const bodyGrid: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(0, 1.55fr) minmax(280px, .8fr)", gap: space[4], alignItems: "start" };
const panelStyle: CSSProperties = { border: `1px solid ${color.border}`, borderRadius: radius.lg, background: color.bg1, boxShadow: shadow.sm, overflow: "hidden" };
const panelHead: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: space[2], padding: `${space[3]}px ${space[4]}px`, borderBottom: `1px solid ${color.borderSoft}` };
const sectionTitle: CSSProperties = { fontSize: font.size.md, fontWeight: font.weight.semibold };
const mutedMono: CSSProperties = { fontSize: font.size.xs, color: color.text2, fontFamily: font.mono };
const hunkCard: CSSProperties = { border: `1px solid ${color.border}`, borderRadius: radius.md, padding: space[3], display: "grid", gap: space[3], animation: `de-rise ${ENTRY_MS}ms ${ENTRY_EASE} both` };
const hunkTitle: CSSProperties = { fontSize: font.size.lg, fontWeight: font.weight.semibold };
const hunkMeta: CSSProperties = { marginTop: 2, fontSize: font.size.xs, color: color.text2, fontFamily: font.mono };
const barTrack: CSSProperties = { width: "100%", height: 8, borderRadius: radius.pill, background: color.bg3, overflow: "hidden" };
const barFill: CSSProperties = { height: "100%", transformOrigin: "left center", animation: `de-bar 560ms ${ENTRY_EASE} both` };
const evidenceGrid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: space[2] };
const evidenceCard: CSSProperties = { border: `1px solid ${color.borderSoft}`, borderRadius: radius.sm, padding: `${space[2]}px`, display: "grid", gap: 2 };
const evidenceLabel: CSSProperties = { fontSize: font.size.sm, fontWeight: font.weight.medium };
const evidenceSource: CSSProperties = { fontSize: font.size.xs, color: color.text2, fontFamily: font.mono };
const evidenceStrength: CSSProperties = { fontSize: font.size.xs, color: color.text1, fontFamily: font.mono, justifySelf: "end" };
const warningText: CSSProperties = { fontSize: font.size.xs, color: color.danger, fontFamily: font.mono };
const sidebarStyle: CSSProperties = { display: "grid", gap: space[3] };
const insightLead: CSSProperties = { fontSize: font.size.lg, fontWeight: font.weight.semibold };
const insightText: CSSProperties = { fontSize: font.size.sm, color: color.text1, lineHeight: 1.65 };
function chipStyle(tint: string): CSSProperties { return { display: "inline-flex", alignItems: "center", padding: `4px ${space[2]}px`, borderRadius: radius.pill, background: `${tint}16`, color: tint, fontSize: font.size.xs, fontFamily: font.mono, fontWeight: font.weight.semibold, textTransform: "uppercase" }; }
function evidenceKind(tint: string): CSSProperties { return { justifySelf: "start", display: "inline-flex", padding: `2px ${space[1]}px`, borderRadius: radius.pill, background: `${tint}16`, color: tint, fontSize: 10, fontFamily: font.mono, textTransform: "uppercase" }; }
