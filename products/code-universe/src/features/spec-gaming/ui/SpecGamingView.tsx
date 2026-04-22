// SpecGamingView — reward hacking / specification gaming signals.
// --------------------------------------------------------------------
// Top: hero banner — "N files show reward hacking signal" + heat color.
// Middle: 5-signal table per file (testModifiedToPass / mockOveruse /
// assertionWeakening / skipAnnotations / narrowTypes) rendered as
// coloured bars. Bottom: ranked worst-offenders list with composite
// risk. Right rail: insight card reminding reviewers to diff both test
// and src in PR review.
//
// Reference: Amodei et al. "Concrete Problems in AI Safety" (2016);
// Krakovna et al. specification gaming examples; Anthropic sycophancy
// research (2023).

import { memo, useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactElement } from "react";

import type { Entity } from "@quanta/canvas-engine";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, shadow, space, transition } from "../../../shared/ui/tokens";
import {
  specGamingSignals,
  type SpecGamingSignal,
} from "../../../shared/analytics/synth-metrics";

interface Props {
  ctx: ViewContextValue;
}

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 520;
const STAGGER_MS = 14;
const COUNTER_MS = 640;

const KEYFRAMES = `
@keyframes sg-enter { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
@keyframes sg-tile  { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
@keyframes sg-row   { from { opacity: 0; transform: translateX(-4px); } to { opacity: 1; transform: translateX(0); } }
@keyframes sg-bar   { from { transform: scaleX(0); } to { transform: scaleX(1); } }
`;

const SIGNAL_LABEL: Record<keyof SpecGamingSignal["signals"], string> = {
  testModifiedToPass: "test→pass",
  mockOveruse: "mock overuse",
  assertionWeakening: "assert↓",
  skipAnnotations: "skip/xit",
  narrowTypes: "loose types",
};

const SIGNAL_TINT: Record<keyof SpecGamingSignal["signals"], string> = {
  testModifiedToPass: color.danger,
  mockOveruse: color.warn,
  assertionWeakening: "#e5484d",
  skipAnnotations: color.accent,
  narrowTypes: color.text1,
};

function riskColor(score: number): string {
  if (score >= 0.6) return color.danger;
  if (score >= 0.4) return color.warn;
  if (score >= 0.2) return color.accent;
  return color.success;
}

function riskTier(score: number): string {
  if (score >= 0.6) return "HIGH";
  if (score >= 0.4) return "MED";
  if (score >= 0.2) return "LOW";
  return "SAFE";
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

interface Row extends SpecGamingSignal {
  entity: Entity | undefined;
}

function SpecGamingViewImpl({ ctx }: Props): ReactElement | null {
  const data = useMemo(() => {
    if (!ctx.tree) return null;
    const signals = specGamingSignals(ctx.tree);
    if (signals.length === 0) return null;
    const rows: Row[] = signals.map(s => ({ ...s, entity: ctx.tree!.byId.get(s.fileId) }));
    const avg = rows.reduce((a, r) => a + r.compositeRisk, 0) / rows.length;
    const high = rows.filter(r => r.compositeRisk >= 0.6).length;
    const med = rows.filter(r => r.compositeRisk >= 0.4 && r.compositeRisk < 0.6).length;
    return { rows, avg, high, med, total: rows.length };
  }, [ctx.tree]);

  if (!data) {
    return (
      <div style={rootStyle}>
        <style>{KEYFRAMES}</style>
        <div style={emptyStyle}>Reward hacking 신호 데이터를 계산할 파일이 없습니다.</div>
      </div>
    );
  }

  const totalC = useCounter(data.total, COUNTER_MS);
  const highC = useCounter(data.high, COUNTER_MS);
  const avgC = useCounter(data.avg * 100, COUNTER_MS);

  const banner =
    data.high > 0
      ? { tint: color.danger, copy: "리뷰 critical — test 수정 신호 다수" }
      : data.avg >= 0.3
      ? { tint: color.warn, copy: "일부 파일에서 reward hacking 신호 감지" }
      : { tint: color.success, copy: "spec-gaming 신호 낮음" };

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>

      <header style={headerStyle}>
        <div>
          <div style={titleStyle}>
            Spec Gaming · <span style={{ color: banner.tint, fontWeight: font.weight.semibold }}>
              reward hacking 탐지
            </span>
          </div>
          <div style={subtitleStyle}>
            test edit × mock × assertion × skip × loose types composite · {data.total}개 파일
          </div>
        </div>
        <div style={refStyle}>
          Amodei et al. (2016) · Krakovna et al.<br />
          Anthropic sycophancy 2023
        </div>
      </header>

      {/* Hero banner */}
      <section style={{
        ...heroBanner,
        background: `linear-gradient(90deg, ${banner.tint}14 0%, ${color.bg1} 55%)`,
        borderColor: `${banner.tint}44`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: space[4] }}>
          <span style={{ ...bannerGlyph, color: banner.tint }}>⚠</span>
          <div>
            <div style={bannerTitle}>
              <span style={{ color: banner.tint, fontWeight: font.weight.bold }}>
                {Math.round(totalC)}
              </span>{" "}
              files show reward hacking signal
            </div>
            <div style={bannerSub}>{banner.copy}</div>
          </div>
        </div>
        <div style={bannerMetrics}>
          <div style={bannerMetric}>
            <div style={bannerMetricLabel}>HIGH</div>
            <div style={{ ...bannerMetricVal, color: color.danger }}>{Math.round(highC)}</div>
          </div>
          <div style={bannerMetric}>
            <div style={bannerMetricLabel}>MED</div>
            <div style={{ ...bannerMetricVal, color: color.warn }}>{data.med}</div>
          </div>
          <div style={bannerMetric}>
            <div style={bannerMetricLabel}>avg risk</div>
            <div style={{ ...bannerMetricVal, color: banner.tint }}>{avgC.toFixed(1)}%</div>
          </div>
        </div>
      </section>

      <section style={bodyGrid}>
        {/* 5-signal table */}
        <div style={tableWrap}>
          <div style={scatterHead}>
            <span style={sectionHead}>Per-file 5-signal breakdown</span>
            <span style={mutedMono}>top {Math.min(15, data.rows.length)} · bar = signal strength</span>
          </div>
          <div style={listStyle}>
            <div style={listHeader}>
              <span style={{ ...headCell, width: 28 }} />
              <span style={{ ...headCell, flex: 2 }}>file</span>
              <span style={{ ...headCell, flex: 1 }}>test→pass</span>
              <span style={{ ...headCell, flex: 1 }}>mock</span>
              <span style={{ ...headCell, flex: 1 }}>assert↓</span>
              <span style={{ ...headCell, flex: 1 }}>skip</span>
              <span style={{ ...headCell, flex: 1 }}>loose ty</span>
            </div>
            {data.rows.slice(0, 15).map((r, i) => (
              <button
                key={r.fileId}
                type="button"
                onClick={() => ctx.dispatch.selectEntity(r.fileId)}
                style={{
                  ...fileRow,
                  animationDelay: `${160 + Math.min(i, 15) * STAGGER_MS}ms`,
                }}
              >
                <span style={{ ...rowRank, width: 28 }}>{String(i + 1).padStart(2, "0")}</span>
                <span style={{ flex: 2, minWidth: 0, display: "flex", flexDirection: "column" }}>
                  <span style={rowName}>{r.fileName}</span>
                  <span style={rowPath}>{r.entity?.path ?? ""}</span>
                </span>
                {(Object.keys(SIGNAL_LABEL) as (keyof SpecGamingSignal["signals"])[]).map((k, j) => (
                  <SignalBar key={k} value={r.signals[k]} tint={SIGNAL_TINT[k]} delay={i * 2 + j} />
                ))}
              </button>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <aside style={sidebar}>
          <div style={sidebarHead}>
            <span style={sectionHead}>Review action</span>
            <span style={mutedMono}>how to catch</span>
          </div>
          <div style={sidebarBody}>
            <div style={insightCard}>
              <div style={insightHead}>
                <span style={insightIcon}>◈</span>
                <span style={insightTitle}>diff both test + src</span>
              </div>
              <div style={insightBody}>
                에이전트가 bug를 고치는 대신 test를 고쳐 통과시킬 수 있다.
                PR 리뷰 시 test 변경 + src 변경을 항상 짝으로 확인하라.
              </div>
            </div>
            <div style={insightCard}>
              <div style={insightHead}>
                <span style={insightIcon}>⊘</span>
                <span style={insightTitle}>reject mock over-use</span>
              </div>
              <div style={insightBody}>
                새 mock 추가가 실제 의존성 테스트를 대체하는 패턴은 reward hacking 의심.
              </div>
            </div>
            <div style={insightCard}>
              <div style={insightHead}>
                <span style={insightIcon}>↧</span>
                <span style={insightTitle}>assertion weakening</span>
              </div>
              <div style={insightBody}>
                toEqual → toBeTruthy, 정확 값 → range 변경은 spec-gaming 대표 흔적.
              </div>
            </div>
            <div style={insightCard}>
              <div style={insightHead}>
                <span style={insightIcon}>⚠</span>
                <span style={insightTitle}>skip / .only 금지</span>
              </div>
              <div style={insightBody}>
                PR에서 test.skip, xit, @Ignore 추가는 즉시 block 규칙으로.
              </div>
            </div>
          </div>
        </aside>
      </section>

      {/* Worst offenders */}
      <section style={listSection}>
        <div style={listSectionHead}>
          <span style={sectionHead}>Worst offenders</span>
          <span style={mutedMono}>composite risk · click to select</span>
        </div>
        <div style={listStyle}>
          <div style={listHeader}>
            <span style={{ ...headCell, width: 28 }} />
            <span style={{ ...headCell, flex: 2 }}>file</span>
            <span style={{ ...headCell, width: 64 }}>risk</span>
            <span style={{ ...headCell, flex: 2 }}>composite</span>
            <span style={{ ...headCell, width: 80, textAlign: "right" as const }}>tier</span>
          </div>
          {data.rows.slice(0, 20).map((r, i) => (
            <button
              key={r.fileId}
              type="button"
              onClick={() => ctx.dispatch.selectEntity(r.fileId)}
              style={{
                ...fileRow,
                animationDelay: `${200 + Math.min(i, 20) * STAGGER_MS}ms`,
              }}
            >
              <span style={{ ...rowRank, width: 28 }}>{String(i + 1).padStart(2, "0")}</span>
              <span style={{ flex: 2, minWidth: 0, display: "flex", flexDirection: "column" }}>
                <span style={rowName}>{r.fileName}</span>
                <span style={rowPath}>{r.entity?.path ?? ""}</span>
              </span>
              <span style={{ width: 64, display: "flex", justifyContent: "flex-end" }}>
                <ScorePill score={r.compositeRisk} />
              </span>
              <span style={{ flex: 2 }}>
                <span style={barBase}>
                  <span style={{
                    ...barFill,
                    width: `${Math.max(3, r.compositeRisk * 100)}%`,
                    background: riskColor(r.compositeRisk),
                    animation: `sg-bar 540ms ${ENTRY_EASE} both`,
                    animationDelay: `${220 + i * 10}ms`,
                    transformOrigin: "left center",
                  }} />
                </span>
              </span>
              <span style={{ width: 80, display: "flex", justifyContent: "flex-end" }}>
                <span
                  style={{
                    display: "inline-block",
                    padding: "2px 8px",
                    borderRadius: radius.pill,
                    background: `${riskColor(r.compositeRisk)}1a`,
                    color: riskColor(r.compositeRisk),
                    fontSize: font.size.xxs,
                    fontFamily: font.mono,
                    fontWeight: font.weight.semibold,
                    letterSpacing: font.letter.wide,
                    textTransform: "uppercase",
                  }}
                >
                  {riskTier(r.compositeRisk)}
                </span>
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function SignalBar({
  value, tint, delay,
}: {
  value: number;
  tint: string;
  delay: number;
}): ReactElement {
  return (
    <span style={{ flex: 1, minWidth: 0 }} title={`${(value * 100).toFixed(0)}%`}>
      <span style={barBase}>
        <span
          style={{
            ...barFill,
            width: `${Math.max(3, value * 100)}%`,
            background: tint,
            animation: `sg-bar 540ms ${ENTRY_EASE} both`,
            animationDelay: `${180 + delay * 8}ms`,
            transformOrigin: "left center",
          }}
        />
      </span>
    </span>
  );
}

function ScorePill({ score }: { score: number }): ReactElement {
  const tint = riskColor(score);
  return (
    <span
      style={{
        display: "inline-block",
        fontFamily: font.mono,
        fontSize: font.size.xxs,
        fontWeight: font.weight.semibold,
        background: `color-mix(in srgb, ${tint} 18%, white)`,
        color: tint,
        padding: "2px 8px",
        borderRadius: radius.pill,
        minWidth: 46,
        textAlign: "center",
      }}
    >
      {(score * 100).toFixed(0)}
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
  animation: `sg-enter ${ENTRY_MS}ms ${ENTRY_EASE} both`,
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

const refStyle: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.xxs,
  color: color.text3,
  textAlign: "right",
};

const heroBanner: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: space[4],
  border: `1px solid ${color.border}`,
  borderRadius: radius.lg,
  boxShadow: shadow.xs,
  marginBottom: space[5],
  animation: `sg-tile 460ms ${ENTRY_EASE} both`,
};

const bannerGlyph: CSSProperties = {
  fontSize: 40,
  fontFamily: font.mono,
  lineHeight: 1,
};

const bannerTitle: CSSProperties = {
  fontSize: font.size.xl,
  color: color.text0,
  fontWeight: font.weight.semibold,
};

const bannerSub: CSSProperties = {
  fontSize: font.size.sm,
  color: color.text2,
  marginTop: 2,
};

const bannerMetrics: CSSProperties = {
  display: "flex",
  gap: space[4],
};

const bannerMetric: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
};

const bannerMetricLabel: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text3,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  fontFamily: font.mono,
};

const bannerMetricVal: CSSProperties = {
  fontSize: 24,
  fontFamily: font.mono,
  fontWeight: font.weight.bold,
  fontVariantNumeric: "tabular-nums",
  lineHeight: 1,
};

const bodyGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 280px",
  gap: space[4],
};

const tableWrap: CSSProperties = {
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  padding: space[3],
  display: "flex",
  flexDirection: "column",
  gap: space[2],
};

const scatterHead: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: `0 ${space[1]}px`,
};

const sectionHead: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  margin: 0,
  fontWeight: font.weight.semibold,
};

const mutedMono: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text3,
  fontFamily: font.mono,
};

const sidebar: CSSProperties = {
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  display: "flex",
  flexDirection: "column",
  minWidth: 240,
};

const sidebarHead: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: `${space[3]}px ${space[4]}px`,
  borderBottom: `1px solid ${color.border}`,
};

const sidebarBody: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: space[2],
  padding: space[3],
};

const insightCard: CSSProperties = {
  padding: `${space[2]}px ${space[3]}px`,
  background: color.bg2,
  border: `1px solid ${color.border}`,
  borderRadius: radius.sm,
  animation: `sg-tile 440ms ${ENTRY_EASE} both`,
};

const insightHead: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[2],
};

const insightIcon: CSSProperties = {
  width: 20, height: 20,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: font.mono,
  fontSize: font.size.md,
  color: color.accent,
};

const insightTitle: CSSProperties = {
  fontSize: font.size.sm,
  color: color.text0,
  fontWeight: font.weight.semibold,
};

const insightBody: CSSProperties = {
  marginTop: 4,
  fontSize: font.size.xxs,
  color: color.text2,
  fontFamily: font.mono,
  lineHeight: 1.5,
};

const listSection: CSSProperties = {
  marginTop: space[5],
};

const listSectionHead: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: space[3],
};

const listStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  overflow: "hidden",
};

const listHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[3],
  padding: `${space[2]}px ${space[4]}px`,
  background: color.bg2,
  borderBottom: `1px solid ${color.border}`,
};

const headCell: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  fontWeight: font.weight.semibold,
  fontFamily: font.mono,
};

const fileRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[3],
  padding: `${space[2]}px ${space[4]}px`,
  background: "transparent",
  border: "none",
  borderBottom: `1px solid ${color.borderSoft}`,
  textAlign: "left",
  cursor: "pointer",
  font: "inherit",
  transition: `background ${transition.base}`,
  animation: `sg-row 440ms ${ENTRY_EASE} both`,
};

const rowRank: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.xxs,
  color: color.text3,
  fontVariantNumeric: "tabular-nums",
  flexShrink: 0,
};

const rowName: CSSProperties = {
  fontSize: font.size.sm,
  color: color.text0,
  fontWeight: font.weight.medium,
  display: "block",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const rowPath: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text3,
  fontFamily: font.mono,
  display: "block",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const barBase: CSSProperties = {
  display: "block",
  position: "relative",
  height: 6,
  background: color.bg3,
  borderRadius: radius.pill,
  overflow: "hidden",
};

const barFill: CSSProperties = {
  display: "block",
  height: "100%",
  borderRadius: radius.pill,
};

export const SpecGamingView = memo(SpecGamingViewImpl);
