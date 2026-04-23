import { memo, useMemo } from "react";
import type { CSSProperties, ReactElement } from "react";
import type { Entity } from "@quanta/canvas-engine";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, shadow, space } from "../../../shared/ui/tokens";
import { contextWaste, type ContextWasteReport } from "../../../shared/analytics/synth-metrics";

export interface ContextWasteViewProps { ctx: ViewContextValue; entity?: Entity; empty?: boolean; }
const ENTRY_MS = 520;
const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const KEYFRAMES = `@keyframes cw-enter{from{opacity:0;transform:scale(.985)}to{opacity:1;transform:scale(1)}} @keyframes cw-rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}} @keyframes cw-bar{from{transform:scaleX(0)}to{transform:scaleX(1)}}`;
function compact(n: number): string { return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K` : `${n}`; }
function pct(n: number): string { return `${Math.round(n * 100)}%`; }

function ContextWasteViewImpl({ ctx, entity, empty }: ContextWasteViewProps): ReactElement {
  const report = useMemo<ContextWasteReport | null>(() => {
    if (!entity || !ctx.tree) return null;
    return contextWaste(entity, ctx.tree, ctx.graph?.fileEdges);
  }, [ctx.graph, ctx.tree, entity]);

  if (empty || !report) return <div style={emptyStyle}><style>{KEYFRAMES}</style>파일을 선택하면 prompt budget 낭비를 slice 단위로 보여줍니다.</div>;
  const savedPct = 1 - report.minimumViableTokens / Math.max(1, report.loadedTokens);

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>
      <header style={headerStyle}>
        <div>
          <div style={titleStyle}>Context Waste · <span style={{ color: color.warn }}>{report.fileName}</span></div>
          <div style={subtitleStyle}>minimum viable prompt · middle-loss · freshness drift</div>
        </div>
        <div style={refStyle}>Liu et al. 2024 · Du et al. 2025</div>
      </header>

      <section style={heroGrid}>
        <Metric label="loaded" value={compact(report.loadedTokens)} sub="tokens" tint={color.text0} />
        <Metric label="wasted" value={compact(report.wastedTokens)} sub={pct(report.wastePct)} tint={report.wastePct >= 0.5 ? color.danger : color.warn} />
        <Metric label="minimum viable" value={compact(report.minimumViableTokens)} sub={`${Math.round(savedPct * 100)}% reducible`} tint={color.success} />
        <Metric label="middle-loss" value={pct(report.middleLossRisk)} sub={`freshness ${pct(report.freshnessRisk)}`} tint={report.middleLossRisk >= 0.5 ? color.danger : color.warn} />
      </section>

      <section style={bodyGrid}>
        <div style={panelStyle}>
          <div style={panelHead}><span style={sectionTitle}>Slice utilization</span><span style={mutedMono}>used vs waste by prompt section</span></div>
          <div style={{ padding: space[4], display: "grid", gap: space[3] }}>
            {report.slices.map((slice, index) => (
              <article key={slice.id} style={{ ...sliceCard, animationDelay: `${index * 18}ms` }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: space[2] }}>
                  <div>
                    <div style={sliceTitle}>{slice.label}</div>
                    <div style={sliceMeta}>{slice.positionBias} bias · importance {pct(slice.importance)}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={tokenNum}>{compact(slice.tokens)}</div>
                    <div style={sliceMeta}>tokens</div>
                  </div>
                </div>
                <div style={legendRow}><span style={{ color: color.success }}>used {compact(slice.usedTokens)}</span><span style={{ color: color.danger }}>waste {compact(slice.wasteTokens)}</span></div>
                <div style={stackTrack}>
                  <div style={{ ...stackFill, width: `${Math.max(4, slice.usedTokens / Math.max(1, slice.tokens) * 100)}%`, background: color.success }} />
                  <div style={{ ...stackFill, width: `${Math.max(4, slice.wasteTokens / Math.max(1, slice.tokens) * 100)}%`, background: color.danger, opacity: 0.55 }} />
                </div>
              </article>
            ))}
          </div>
        </div>
        <aside style={sidebarStyle}>
          <div style={panelStyle}>
            <div style={panelHead}><span style={sectionTitle}>Prompt budget insight</span></div>
            <div style={{ padding: space[4], display: "grid", gap: space[3] }}>
              <div style={insightLead}>{pct(report.wastePct)} of loaded tokens are not materially used.</div>
              <div style={insightText}>길이를 늘리는 것만으로 성능이 좋아지지 않습니다. 2-hop 이후 slice는 사용 비율이 낮고 middle 위치에 놓일수록 손해가 커집니다. 최소 viable prompt로 줄인 뒤 필요 evidence만 재주입하는 편이 비용과 정확도 모두 유리합니다.</div>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}

function Metric({ label, value, sub, tint }: { label: string; value: string; sub: string; tint: string }): ReactElement { return <div style={metricCard}><div style={metricLabel}>{label}</div><div style={{ ...metricValue, color: tint }}>{value}</div><div style={metricSub}>{sub}</div></div>; }
export const ContextWasteView = memo(ContextWasteViewImpl);
const rootStyle: CSSProperties = { width: "100%", height: "100%", overflowY: "auto", background: color.bg0, color: color.text0, fontFamily: font.sans, padding: `${space[5]}px ${space[6]}px`, boxSizing: "border-box", display: "grid", gap: space[4], animation: `cw-enter ${ENTRY_MS}ms ${ENTRY_EASE} both` };
const emptyStyle: CSSProperties = { width: "100%", height: "100%", display: "grid", placeItems: "center", color: color.text3, fontFamily: font.sans };
const headerStyle: CSSProperties = { display: "flex", justifyContent: "space-between", gap: space[4] };
const titleStyle: CSSProperties = { fontSize: font.size.display, fontWeight: font.weight.semibold };
const subtitleStyle: CSSProperties = { marginTop: 4, fontSize: font.size.sm, color: color.text2 };
const refStyle: CSSProperties = { fontSize: font.size.xs, color: color.text2, fontFamily: font.mono, textAlign: "right" };
const heroGrid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: space[3] };
const metricCard: CSSProperties = { border: `1px solid ${color.border}`, borderRadius: radius.lg, background: color.bg1, boxShadow: shadow.sm, padding: space[4], display: "grid", gap: space[2] };
const metricLabel: CSSProperties = { fontSize: font.size.xs, color: color.text2, fontFamily: font.mono, textTransform: "uppercase" };
const metricValue: CSSProperties = { fontSize: 30, lineHeight: 1, fontWeight: font.weight.semibold, fontVariantNumeric: "tabular-nums" };
const metricSub: CSSProperties = { fontSize: font.size.sm, color: color.text2 };
const bodyGrid: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(0, 1.55fr) minmax(280px, .8fr)", gap: space[4], alignItems: "start" };
const panelStyle: CSSProperties = { border: `1px solid ${color.border}`, borderRadius: radius.lg, background: color.bg1, boxShadow: shadow.sm, overflow: "hidden" };
const panelHead: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: space[2], padding: `${space[3]}px ${space[4]}px`, borderBottom: `1px solid ${color.borderSoft}` };
const sectionTitle: CSSProperties = { fontSize: font.size.md, fontWeight: font.weight.semibold };
const mutedMono: CSSProperties = { fontSize: font.size.xs, color: color.text2, fontFamily: font.mono };
const sliceCard: CSSProperties = { border: `1px solid ${color.border}`, borderRadius: radius.md, padding: space[3], display: "grid", gap: space[2], animation: `cw-rise ${ENTRY_MS}ms ${ENTRY_EASE} both` };
const sliceTitle: CSSProperties = { fontSize: font.size.lg, fontWeight: font.weight.semibold };
const sliceMeta: CSSProperties = { marginTop: 2, fontSize: font.size.xs, color: color.text2, fontFamily: font.mono };
const tokenNum: CSSProperties = { fontSize: font.size.lg, fontFamily: font.mono, fontWeight: font.weight.semibold };
const legendRow: CSSProperties = { display: "flex", justifyContent: "space-between", gap: space[2], fontSize: font.size.xs, fontFamily: font.mono };
const stackTrack: CSSProperties = { display: "flex", width: "100%", height: 10, background: color.bg3, borderRadius: radius.pill, overflow: "hidden" };
const stackFill: CSSProperties = { height: "100%", animation: `cw-bar 560ms ${ENTRY_EASE} both`, transformOrigin: "left center" };
const sidebarStyle: CSSProperties = { display: "grid", gap: space[3] };
const insightLead: CSSProperties = { fontSize: font.size.lg, fontWeight: font.weight.semibold };
const insightText: CSSProperties = { fontSize: font.size.sm, color: color.text1, lineHeight: 1.65 };
