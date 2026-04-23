import { memo, useMemo } from "react";
import type { CSSProperties, ReactElement } from "react";
import type { Entity } from "@quanta/canvas-engine";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, shadow, space } from "../../../shared/ui/tokens";
import { trajectoryDecompose, type AgentTrajectoryStage, type TrajectoryDiagnosis } from "../../../shared/analytics/synth-metrics";

export interface TrajectoryDecomposeViewProps { ctx: ViewContextValue; entity?: Entity; empty?: boolean; }
const ENTRY_MS = 520;
const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const STAGES: readonly AgentTrajectoryStage[] = ["search", "read", "edit", "verify", "recover"];
const STAGE_LABEL: Record<AgentTrajectoryStage, string> = { search: "Search", read: "Read", edit: "Edit", verify: "Verify", recover: "Recover" };
const STAGE_TINT: Record<AgentTrajectoryStage, string> = { search: color.accent, read: "#7e4ed6", edit: color.warn, verify: color.success, recover: color.danger };
const KEYFRAMES = `@keyframes td-enter { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } } @keyframes td-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } } @keyframes td-bar { from { transform: scaleX(0); } to { transform: scaleX(1); } }`;

function pct(n: number): string { return `${Math.round(n * 100)}%`; }
function stageBand(score: number): { label: string; tint: string } { return score >= 0.72 ? { label: "solid", tint: color.success } : score >= 0.5 ? { label: "fragile", tint: color.warn } : { label: "failing", tint: color.danger }; }

function TrajectoryDecomposeViewImpl({ ctx, entity, empty }: TrajectoryDecomposeViewProps): ReactElement {
  const diag = useMemo<TrajectoryDiagnosis | null>(() => {
    if (!entity || !ctx.tree) return null;
    return trajectoryDecompose(entity, ctx.tree, ctx.graph?.fileEdges);
  }, [ctx.graph, ctx.tree, entity]);

  if (empty || !diag) {
    return <div style={emptyStyle}><style>{KEYFRAMES}</style>파일을 선택하면 agent trajectory를 단계별로 분해합니다.</div>;
  }

  const bottleneck = diag.stages.find(stage => stage.stage === diag.bottleneck)!;
  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>
      <header style={headerStyle}>
        <div>
          <div style={titleStyle}>Trajectory Decompose · <span style={{ color: STAGE_TINT[diag.bottleneck] }}>{diag.fileName}</span></div>
          <div style={subtitleStyle}>search → read → edit → verify → recover · code-agent stage diagnosis</div>
        </div>
        <div style={refStyle}>TRAJEVAL 2026 · stage diagnostics over pass@1</div>
      </header>

      <section style={heroGrid}>
        <MetricCard label="overall success" value={pct(diag.overallSuccess)} tint={diag.overallSuccess >= 0.6 ? color.success : diag.overallSuccess >= 0.4 ? color.warn : color.danger} sub="expected end-to-end" />
        <MetricCard label="overread ratio" value={`${diag.overreadRatio.toFixed(1)}×`} tint={diag.overreadRatio <= 8 ? color.success : diag.overreadRatio <= 15 ? color.warn : color.danger} sub={`${diag.examinedFunctions} / ${diag.necessaryFunctions} funcs`} />
        <MetricCard label="bottleneck" value={STAGE_LABEL[diag.bottleneck]} tint={STAGE_TINT[diag.bottleneck]} sub={`${pct(bottleneck.score)} stage score`} />
        <MetricCard label="first correct edit" value={`${diag.firstCorrectEditStep}`} tint={color.text0} sub="step index" />
      </section>

      <section style={bodyGrid}>
        <div style={panelStyle}>
          <div style={panelHead}><span style={sectionTitle}>Stage ladder</span><span style={mutedMono}>precision / recall / waste</span></div>
          <div style={{ padding: space[4], display: "grid", gap: space[3] }}>
            {diag.stages.map((stage, index) => {
              const band = stageBand(stage.score);
              return (
                <article key={stage.stage} style={{ ...stageCard, animationDelay: `${index * 18}ms` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: space[2], alignItems: "center" }}>
                    <div>
                      <div style={stageTitle}>{STAGE_LABEL[stage.stage]}</div>
                      <div style={stageMeta}>{stage.steps} steps · {Math.round(stage.tokenShare * 100)}% token share</div>
                    </div>
                    <span style={chipStyle(band.tint)}>{band.label}</span>
                  </div>
                  <div style={metricRow}><span style={miniLabel}>precision</span><Bar value={stage.precision} tint={STAGE_TINT[stage.stage]} /><span style={miniNum}>{pct(stage.precision)}</span></div>
                  <div style={metricRow}><span style={miniLabel}>recall</span><Bar value={stage.recall} tint={color.success} /><span style={miniNum}>{pct(stage.recall)}</span></div>
                  <div style={metricRow}><span style={miniLabel}>waste</span><Bar value={stage.wasteShare} tint={color.danger} /><span style={miniNum}>{pct(stage.wasteShare)}</span></div>
                </article>
              );
            })}
          </div>
        </div>

        <aside style={sidebarStyle}>
          <div style={panelStyle}>
            <div style={panelHead}><span style={sectionTitle}>Bottleneck insight</span><span style={mutedMono}>{STAGE_LABEL[diag.bottleneck]}</span></div>
            <div style={{ padding: space[4], display: "grid", gap: space[3] }}>
              <div style={insightLead}>현재 가장 큰 손실은 <span style={{ color: STAGE_TINT[diag.bottleneck], fontWeight: font.weight.semibold }}>{STAGE_LABEL[diag.bottleneck]}</span> 단계입니다.</div>
              <div style={insightText}>읽는 함수 수가 실제 필요한 함수 수보다 {diag.overreadRatio.toFixed(1)}배 많습니다. 탐색 범위를 줄이거나 retrieval 근거를 먼저 압축해 search/read 낭비를 줄이는 편이 end-to-end 성공률을 더 크게 올립니다.</div>
            </div>
          </div>
          <div style={panelStyle}>
            <div style={panelHead}><span style={sectionTitle}>Stage profile</span></div>
            <div style={{ padding: space[4], display: "grid", gap: space[2] }}>
              {STAGES.map(stageKey => {
                const row = diag.stages.find(stage => stage.stage === stageKey)!;
                return <div key={stageKey} style={profileRow}><span style={{ color: STAGE_TINT[stageKey], fontWeight: font.weight.semibold }}>{STAGE_LABEL[stageKey]}</span><span style={mutedMono}>{pct(row.score)}</span></div>;
              })}
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}

function MetricCard({ label, value, tint, sub }: { label: string; value: string; tint: string; sub: string }): ReactElement {
  return <div style={metricCard}><div style={metricLabel}>{label}</div><div style={{ ...metricValue, color: tint }}>{value}</div><div style={metricSub}>{sub}</div></div>;
}
function Bar({ value, tint }: { value: number; tint: string }): ReactElement { return <div style={barTrack}><div style={{ ...barFill, width: `${Math.max(6, value * 100)}%`, background: tint }} /></div>; }
export const TrajectoryDecomposeView = memo(TrajectoryDecomposeViewImpl);
const rootStyle: CSSProperties = { width: "100%", height: "100%", overflowY: "auto", background: color.bg0, color: color.text0, fontFamily: font.sans, padding: `${space[5]}px ${space[6]}px`, boxSizing: "border-box", display: "grid", gap: space[4], animation: `td-enter ${ENTRY_MS}ms ${ENTRY_EASE} both` };
const emptyStyle: CSSProperties = { width: "100%", height: "100%", display: "grid", placeItems: "center", color: color.text3, fontFamily: font.sans };
const headerStyle: CSSProperties = { display: "flex", justifyContent: "space-between", gap: space[4], alignItems: "flex-start" };
const titleStyle: CSSProperties = { fontSize: font.size.display, fontWeight: font.weight.semibold };
const subtitleStyle: CSSProperties = { marginTop: 4, fontSize: font.size.sm, color: color.text2 };
const refStyle: CSSProperties = { fontSize: font.size.xs, color: color.text2, fontFamily: font.mono, textAlign: "right" };
const heroGrid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: space[3] };
const metricCard: CSSProperties = { border: `1px solid ${color.border}`, borderRadius: radius.lg, background: color.bg1, boxShadow: shadow.sm, padding: space[4], display: "grid", gap: space[2] };
const metricLabel: CSSProperties = { fontSize: font.size.xs, color: color.text2, fontFamily: font.mono, textTransform: "uppercase", letterSpacing: font.letter.wide };
const metricValue: CSSProperties = { fontSize: 30, lineHeight: 1, fontWeight: font.weight.semibold, fontVariantNumeric: "tabular-nums" };
const metricSub: CSSProperties = { fontSize: font.size.sm, color: color.text2 };
const bodyGrid: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(0, 1.6fr) minmax(280px, 0.8fr)", gap: space[4], alignItems: "start" };
const panelStyle: CSSProperties = { border: `1px solid ${color.border}`, borderRadius: radius.lg, background: color.bg1, boxShadow: shadow.sm, overflow: "hidden" };
const panelHead: CSSProperties = { display: "flex", justifyContent: "space-between", gap: space[2], alignItems: "center", padding: `${space[3]}px ${space[4]}px`, borderBottom: `1px solid ${color.borderSoft}` };
const sectionTitle: CSSProperties = { fontSize: font.size.md, fontWeight: font.weight.semibold };
const mutedMono: CSSProperties = { fontSize: font.size.xs, color: color.text2, fontFamily: font.mono };
const stageCard: CSSProperties = { border: `1px solid ${color.border}`, borderRadius: radius.md, padding: space[3], display: "grid", gap: space[2], animation: `td-rise ${ENTRY_MS}ms ${ENTRY_EASE} both` };
const stageTitle: CSSProperties = { fontSize: font.size.lg, fontWeight: font.weight.semibold };
const stageMeta: CSSProperties = { marginTop: 2, fontSize: font.size.xs, color: color.text2, fontFamily: font.mono };
const metricRow: CSSProperties = { display: "grid", gridTemplateColumns: "72px minmax(0, 1fr) 48px", gap: space[2], alignItems: "center" };
const miniLabel: CSSProperties = { fontSize: font.size.xs, color: color.text2, fontFamily: font.mono, textTransform: "uppercase" };
const miniNum: CSSProperties = { fontSize: font.size.xs, color: color.text1, fontFamily: font.mono, textAlign: "right" };
const barTrack: CSSProperties = { width: "100%", height: 8, borderRadius: radius.pill, background: color.bg3, overflow: "hidden" };
const barFill: CSSProperties = { height: "100%", transformOrigin: "left center", animation: `td-bar 560ms ${ENTRY_EASE} both` };
const sidebarStyle: CSSProperties = { display: "grid", gap: space[3] };
const insightLead: CSSProperties = { fontSize: font.size.lg, fontWeight: font.weight.semibold, lineHeight: 1.4 };
const insightText: CSSProperties = { fontSize: font.size.sm, color: color.text1, lineHeight: 1.65 };
const profileRow: CSSProperties = { display: "flex", justifyContent: "space-between", gap: space[2], alignItems: "center", paddingBottom: space[2], borderBottom: `1px solid ${color.borderSoft}` };
function chipStyle(tint: string): CSSProperties { return { display: "inline-flex", alignItems: "center", padding: `4px ${space[2]}px`, borderRadius: radius.pill, background: `${tint}16`, color: tint, fontSize: font.size.xs, fontFamily: font.mono, fontWeight: font.weight.semibold, textTransform: "uppercase" }; }
