import { memo, useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactElement } from "react";

import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, shadow, space } from "../../../shared/ui/tokens";
import {
  specGamingSignals,
  type SpecGamingSignal,
} from "../../../shared/analytics/synth-metrics";

interface Props {
  ctx: ViewContextValue;
}

const ENTRY_MS = 520;
const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const STAGGER_MS = 18;
const COUNTER_MS = 640;

const KEYFRAMES = `
@keyframes sg-enter { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
@keyframes sg-row { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
@keyframes sg-bar { from { transform: scaleX(0); } to { transform: scaleX(1); } }
`;

const SIGNALS: ReadonlyArray<{
  key: keyof SpecGamingSignal["signals"];
  label: string;
  tint: string;
}> = [
  { key: "testModifiedToPass", label: "test edit", tint: color.danger },
  { key: "mockOveruse", label: "mock 과다", tint: color.warn },
  { key: "assertionWeakening", label: "assert 완화", tint: color.danger },
  { key: "skipAnnotations", label: "skip", tint: color.warn },
  { key: "narrowTypes", label: "loose type", tint: color.accent },
];

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

function riskBand(risk: number): { label: string; tint: string } {
  if (risk >= 0.75) return { label: "critical", tint: color.danger };
  if (risk >= 0.5) return { label: "warning", tint: color.warn };
  return { label: "watch", tint: color.accent };
}

function SpecGamingViewImpl({ ctx }: Props): ReactElement | null {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const data = useMemo(() => {
    if (!ctx.tree) return null;
    const rows = specGamingSignals(ctx.tree);
    if (rows.length === 0) return null;
    const maxRisk = rows[0]?.compositeRisk ?? 0;
    const severeCount = rows.filter(row => row.compositeRisk >= 0.5).length;
    const avgRisk = rows.reduce((sum, row) => sum + row.compositeRisk, 0) / rows.length;
    return { rows, maxRisk, severeCount, avgRisk };
  }, [ctx.tree]);

  const active = useMemo(() => {
    if (!data) return null;
    return data.rows.find(row => row.fileId === selectedId) ?? data.rows[0] ?? null;
  }, [data, selectedId]);

  const flaggedCounter = useCounter(data?.rows.length ?? 0, COUNTER_MS);
  const avgCounter = useCounter((data?.avgRisk ?? 0) * 100, COUNTER_MS);

  if (!data || !active) {
    return (
      <div style={rootStyle}>
        <style>{KEYFRAMES}</style>
        <div style={emptyStyle}>Reward hacking 신호를 계산할 파일이 없습니다.</div>
      </div>
    );
  }

  const band = riskBand(data.maxRisk);

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>
      <header style={headerStyle}>
        <div>
          <div style={titleStyle}>
            Spec Gaming · <span style={{ color: band.tint }}>reward hacking audit</span>
          </div>
          <div style={subtitleStyle}>
            test edit × mock 과다 × assertion 완화 × skip × loose type · {data.rows.length}개 파일
          </div>
        </div>
        <div style={refStyle}>
          Amodei et al. 2016 · Krakovna spec gaming<br />
          Anthropic sycophancy 2023
        </div>
      </header>

      <section style={heroStyle}>
        <div style={{ ...heroBanner, borderColor: `${band.tint}55`, background: `${band.tint}10` }}>
          <div style={heroLabel}>reward hacking signal</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: space[3], flexWrap: "wrap" }}>
            <div style={{ ...heroValue, color: band.tint }}>{Math.round(flaggedCounter)} files</div>
            <div style={chipStyle(band.tint)}>{band.label}</div>
            <div style={subtleText}>agent가 테스트를 고쳐 통과시키는 패턴을 우선 검토</div>
          </div>
        </div>
        <div style={heroTile}>
          <div style={heroLabel}>avg composite risk</div>
          <div style={{ ...heroValue, color: color.text0 }}>{avgCounter.toFixed(1)}%</div>
          <div style={subtleText}>{data.severeCount} files ≥ 0.50</div>
        </div>
      </section>

      <section style={bodyGrid}>
        <div style={panelStyle}>
          <div style={panelHead}>
            <span style={sectionTitle}>5-signal matrix</span>
            <span style={mutedMono}>bar = signal strength</span>
          </div>
          <div style={tableHeader}>
            <span style={{ ...headCell, flex: 1 }}>file</span>
            {SIGNALS.map(signal => (
              <span key={signal.key} style={{ ...headCell, width: 86, textAlign: "center" }}>{signal.label}</span>
            ))}
            <span style={{ ...headCell, width: 94, textAlign: "right" }}>risk</span>
          </div>
          <div>
            {data.rows.slice(0, 12).map((row, index) => {
              const rowBand = riskBand(row.compositeRisk);
              const isActive = row.fileId === active.fileId;
              return (
                <button
                  key={row.fileId}
                  type="button"
                  onClick={() => {
                    setSelectedId(row.fileId);
                    ctx.dispatch.selectEntity(row.fileId);
                  }}
                  style={{
                    ...tableRow,
                    background: isActive ? color.accentSofter : color.bg0,
                    borderColor: isActive ? color.accentBorder : color.borderSoft,
                    animationDelay: `${120 + index * STAGGER_MS}ms`,
                  }}
                >
                  <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                    <span style={rowName}>{row.fileName}</span>
                    <span style={rowMeta}>{rowBand.label}</span>
                  </span>
                  {SIGNALS.map(signal => (
                    <span key={signal.key} style={{ width: 86 }}>
                      <Bar value={row.signals[signal.key]} tint={signal.tint} />
                    </span>
                  ))}
                  <span style={{ ...riskCell, width: 94, color: rowBand.tint }}>
                    {(row.compositeRisk * 100).toFixed(0)}%
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <aside style={sidebarStyle}>
          <div style={panelHead}>
            <span style={sectionTitle}>Reviewer insight</span>
            <span style={mutedMono}>selected file</span>
          </div>
          <div style={insightCard}>
            <div style={{ ...chipStyle(riskBand(active.compositeRisk).tint), alignSelf: "flex-start" }}>
              {active.fileName}
            </div>
            <div style={insightTitle}>agent may be modifying tests instead of fixing bugs</div>
            <div style={insightText}>
              테스트 변경과 소스 변경을 항상 같이 리뷰하세요. assertion 완화, skip 추가,
              mock 대체는 “원인 해결”이 아니라 “통과 만들기”일 가능성이 큽니다.
            </div>
            <div style={{ display: "grid", gap: space[2] }}>
              {SIGNALS.map(signal => (
                <div key={signal.key}>
                  <div style={driverHead}>
                    <span>{signal.label}</span>
                    <span style={{ color: signal.tint }}>{Math.round(active.signals[signal.key] * 100)}%</span>
                  </div>
                  <Bar value={active.signals[signal.key]} tint={signal.tint} />
                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>

      <section style={bottomPanel}>
        <div style={panelHead}>
          <span style={sectionTitle}>Worst offenders</span>
          <span style={mutedMono}>composite risk ranking</span>
        </div>
        <div style={rankGrid}>
          {data.rows.slice(0, 6).map((row, index) => {
            const bandRow = riskBand(row.compositeRisk);
            return (
              <button
                key={`rank-${row.fileId}`}
                type="button"
                onClick={() => {
                  setSelectedId(row.fileId);
                  ctx.dispatch.selectEntity(row.fileId);
                }}
                style={{ ...rankCard, animationDelay: `${240 + index * STAGGER_MS}ms` }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: space[2] }}>
                  <span style={rowName}>{row.fileName}</span>
                  <span style={{ ...chipStyle(bandRow.tint), whiteSpace: "nowrap" }}>
                    {(row.compositeRisk * 100).toFixed(0)}%
                  </span>
                </div>
                <div style={rankSignals}>
                  {SIGNALS.map(signal => (
                    <span
                      key={signal.key}
                      style={{
                        ...miniDot,
                        background: signal.tint,
                        opacity: 0.18 + row.signals[signal.key] * 0.82,
                      }}
                      title={`${signal.label}: ${Math.round(row.signals[signal.key] * 100)}%`}
                    />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Bar({ value, tint }: { value: number; tint: string }): ReactElement {
  return (
    <div style={barTrack}>
      <div
        style={{
          ...barFill,
          width: `${Math.max(4, value * 100)}%`,
          background: tint,
          animation: `sg-bar 540ms ${ENTRY_EASE} both`,
        }}
      />
    </div>
  );
}

export const SpecGamingView = memo(SpecGamingViewImpl);

const rootStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  overflowY: "auto",
  background: color.bg0,
  color: color.text0,
  fontFamily: font.sans,
  padding: `${space[5]}px ${space[6]}px ${space[6]}px`,
  boxSizing: "border-box",
  display: "grid",
  gap: space[4],
  animation: `sg-enter ${ENTRY_MS}ms ${ENTRY_EASE} both`,
};
const headerStyle: CSSProperties = { display: "flex", justifyContent: "space-between", gap: space[4], alignItems: "flex-start" };
const titleStyle: CSSProperties = { fontSize: font.size.display, fontWeight: font.weight.semibold, letterSpacing: font.letter.tight };
const subtitleStyle: CSSProperties = { marginTop: 4, fontSize: font.size.sm, color: color.text2 };
const refStyle: CSSProperties = { fontSize: font.size.xs, color: color.text2, textAlign: "right", lineHeight: 1.5, fontFamily: font.mono };
const heroStyle: CSSProperties = { display: "grid", gridTemplateColumns: "1.7fr 0.8fr", gap: space[3] };
const heroBanner: CSSProperties = { border: `1px solid ${color.border}`, borderRadius: radius.lg, padding: space[4], boxShadow: shadow.sm };
const heroTile: CSSProperties = { border: `1px solid ${color.border}`, borderRadius: radius.lg, padding: space[4], background: color.bg1, boxShadow: shadow.sm };
const heroLabel: CSSProperties = { fontSize: font.size.xs, color: color.text2, textTransform: "uppercase", letterSpacing: font.letter.wide, fontFamily: font.mono };
const heroValue: CSSProperties = { marginTop: space[2], fontSize: 34, lineHeight: 1, fontWeight: font.weight.semibold };
const subtleText: CSSProperties = { fontSize: font.size.sm, color: color.text1 };
const bodyGrid: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(0, 1.55fr) minmax(280px, 0.85fr)", gap: space[4], alignItems: "start" };
const panelStyle: CSSProperties = { border: `1px solid ${color.border}`, borderRadius: radius.lg, background: color.bg1, boxShadow: shadow.sm, overflow: "hidden" };
const sidebarStyle: CSSProperties = { display: "grid", gap: space[3] };
const panelHead: CSSProperties = { display: "flex", justifyContent: "space-between", gap: space[2], alignItems: "center", padding: `${space[3]}px ${space[4]}px`, borderBottom: `1px solid ${color.borderSoft}` };
const sectionTitle: CSSProperties = { fontSize: font.size.md, fontWeight: font.weight.semibold };
const mutedMono: CSSProperties = { fontSize: font.size.xs, color: color.text2, fontFamily: font.mono };
const tableHeader: CSSProperties = { display: "flex", gap: space[2], alignItems: "center", padding: `${space[2]}px ${space[4]}px`, background: color.bg2, borderBottom: `1px solid ${color.borderSoft}` };
const headCell: CSSProperties = { fontSize: font.size.xs, color: color.text2, fontFamily: font.mono, textTransform: "uppercase", letterSpacing: font.letter.wide };
const tableRow: CSSProperties = { width: "100%", display: "flex", gap: space[2], alignItems: "center", padding: `${space[3]}px ${space[4]}px`, border: "1px solid transparent", borderLeft: "none", borderRight: "none", background: "transparent", cursor: "pointer", animation: `sg-row ${ENTRY_MS}ms ${ENTRY_EASE} both` };
const rowName: CSSProperties = { display: "block", fontSize: font.size.md, fontWeight: font.weight.medium, color: color.text0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
const rowMeta: CSSProperties = { display: "block", marginTop: 2, fontSize: font.size.xs, color: color.text2, fontFamily: font.mono };
const riskCell: CSSProperties = { textAlign: "right", fontFamily: font.mono, fontSize: font.size.sm, fontWeight: font.weight.semibold };
const barTrack: CSSProperties = { width: "100%", height: 7, borderRadius: radius.pill, background: color.bg3, overflow: "hidden" };
const barFill: CSSProperties = { height: "100%", transformOrigin: "left center" };
const insightCard: CSSProperties = { border: `1px solid ${color.border}`, borderRadius: radius.lg, padding: space[4], background: color.bg1, boxShadow: shadow.sm, display: "grid", gap: space[3] };
const insightTitle: CSSProperties = { fontSize: font.size.lg, fontWeight: font.weight.semibold };
const insightText: CSSProperties = { fontSize: font.size.sm, color: color.text1, lineHeight: 1.6 };
const driverHead: CSSProperties = { display: "flex", justifyContent: "space-between", gap: space[2], fontSize: font.size.xs, color: color.text2, marginBottom: 4, fontFamily: font.mono };
const bottomPanel: CSSProperties = { ...panelStyle, paddingBottom: space[4] };
const rankGrid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: space[3], padding: `0 ${space[4]}px` };
const rankCard: CSSProperties = { padding: space[3], border: `1px solid ${color.border}`, borderRadius: radius.md, background: color.bg0, boxShadow: shadow.xs, display: "grid", gap: space[3], cursor: "pointer", animation: `sg-row ${ENTRY_MS}ms ${ENTRY_EASE} both` };
const rankSignals: CSSProperties = { display: "flex", gap: 6 };
const miniDot: CSSProperties = { width: 14, height: 14, borderRadius: radius.pill };
const emptyStyle: CSSProperties = { width: "100%", height: "100%", display: "grid", placeItems: "center", color: color.text3, fontSize: font.size.md };
function chipStyle(tint: string): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: `4px ${space[2]}px`,
    borderRadius: radius.pill,
    background: `${tint}16`,
    color: tint,
    fontFamily: font.mono,
    fontSize: font.size.xs,
    fontWeight: font.weight.semibold,
    textTransform: "uppercase",
    letterSpacing: font.letter.wide,
  };
}
