// ThinkingBudgetView — reasoning-token budget per task kind.
// --------------------------------------------------------------------
// Layout:
//   Hero strip — repo avg thinking ratio + most-expensive task.
//   Table      — one row per AI task. Columns: task · thinking · output
//               · ratio bar · plateau badge · recommended depth chip.
//   Stacked bars — horizontal thinking-vs-output composition per task.
//   Insight card — flags plateau tasks with a "switch to shallow"
//                   recommendation.
//
// Reference: OpenAI o1 technical report 2024. Anthropic Extended
// Thinking 2025. Snell et al. "Thinking beats Scaling" 2024.

import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactElement } from "react";

import type { Entity } from "@quanta/canvas-engine";
import { color, font, radius, shadow, space } from "../../../shared/ui/tokens";
import {
  thinkingTokenUsage,
  type AITaskKind,
  type ThinkingBudget,
} from "../../../shared/analytics/synth-metrics";

interface Props {
  entity?: Entity;
  empty?: boolean;
}

const TASK_KOREAN: Record<AITaskKind, string> = {
  explain: "설명",
  "fix-bug": "버그 수정",
  "add-feature": "기능 추가",
  refactor: "리팩터",
  test: "테스트 작성",
  review: "코드 리뷰",
};

const DEPTH_LABEL: Record<ThinkingBudget["recommendedDepth"], string> = {
  shallow: "shallow",
  medium: "medium",
  deep: "deep",
};

const DEPTH_COLOR: Record<ThinkingBudget["recommendedDepth"], string> = {
  shallow: color.success,
  medium: color.accent,
  deep: color.warn,
};

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 520;

const KEYFRAMES = `
@keyframes tb-enter { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
@keyframes tb-row   { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
@keyframes tb-bar   { from { transform: scaleX(0); } to { transform: scaleX(1); } }
`;

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

/** rAF-driven counter animation from 0 to target over `durationMs`. */
function useRafCounter(target: number, durationMs = 640): number {
  const [v, setV] = useState(0);
  const startedAt = useRef<number | null>(null);
  useEffect(() => {
    startedAt.current = null;
    let raf = 0;
    const tick = (t: number): void => {
      if (startedAt.current === null) startedAt.current = t;
      const elapsed = t - startedAt.current;
      const k = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - k, 3);
      setV(target * eased);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return v;
}

function ThinkingBudgetViewImpl({ entity, empty }: Props): ReactElement {
  const rows = useMemo<ThinkingBudget[]>(
    () => (entity ? thinkingTokenUsage(entity) : []),
    [entity],
  );

  const aggregate = useMemo(() => {
    if (rows.length === 0) {
      return {
        avgRatio: 0,
        mostExpensive: null as ThinkingBudget | null,
        plateauCount: 0,
        totalThinking: 0,
        totalOutput: 0,
      };
    }
    let ratioSum = 0;
    let most: ThinkingBudget = rows[0]!;
    let plateauCount = 0;
    let totalThinking = 0;
    let totalOutput = 0;
    for (const r of rows) {
      ratioSum += r.thinkingRatio;
      if (r.thinkingTokens > most.thinkingTokens) most = r;
      if (r.plateauDetected) plateauCount += 1;
      totalThinking += r.thinkingTokens;
      totalOutput += r.outputTokens;
    }
    return {
      avgRatio: ratioSum / rows.length,
      mostExpensive: most,
      plateauCount,
      totalThinking,
      totalOutput,
    };
  }, [rows]);

  const avgPct = useRafCounter(Math.round(aggregate.avgRatio * 100));

  if (empty || !entity) {
    return (
      <div style={rootStyle}>
        <style>{KEYFRAMES}</style>
        <div style={emptyStyle}>파일을 선택하세요.</div>
      </div>
    );
  }

  const maxTotal = Math.max(1, ...rows.map(r => r.thinkingTokens + r.outputTokens));

  const plateauTasks = rows.filter(r => r.plateauDetected);
  const insight =
    plateauTasks.length > 0
      ? `${plateauTasks.map(r => TASK_KOREAN[r.task]).join(", ")}에서 plateau 감지 — 더 생각해도 정확도 개선이 없습니다. shallow 모드 전환 제안.`
      : "전체 task에서 thinking budget이 여전히 유효합니다. 현재 depth를 유지하세요.";

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>

      <header style={headerStyle}>
        <div>
          <div style={titleStyle}>
            Thinking Budget · <span style={{ color: color.text1, fontWeight: font.weight.medium }}>{entity.name}</span>
          </div>
          <div style={subtitleStyle}>
            {entity.path} · reasoning 토큰 경제학 · o1 / Extended Thinking
          </div>
        </div>
        <div style={{ fontFamily: font.mono, fontSize: font.size.xxs, color: color.text3 }}>
          OpenAI o1 · Anthropic Extended · Snell 2024
        </div>
      </header>

      {/* Hero strip */}
      <div style={heroStripStyle}>
        <HeroTile
          label="avg thinking ratio"
          value={`${Math.round(avgPct)}%`}
          sub="thinking / (thinking + output)"
          accent={color.accent}
        />
        <HeroTile
          label="most expensive"
          value={aggregate.mostExpensive ? TASK_KOREAN[aggregate.mostExpensive.task] : "—"}
          sub={aggregate.mostExpensive ? `${fmtTokens(aggregate.mostExpensive.thinkingTokens)} thinking` : ""}
          accent={color.warn}
        />
        <HeroTile
          label="plateau tasks"
          value={aggregate.plateauCount.toString()}
          sub="추가 reasoning 개선 없음"
          accent={aggregate.plateauCount > 0 ? color.danger : color.success}
        />
        <HeroTile
          label="total thinking"
          value={fmtTokens(aggregate.totalThinking)}
          sub={`${fmtTokens(aggregate.totalOutput)} output`}
          accent={color.text0}
        />
      </div>

      {/* Table */}
      <section style={tableCardStyle}>
        <div style={cardHeadStyle}>
          <span style={cardTitleStyle}>6-task breakdown</span>
          <span style={cardSubStyle}>thinking · output · ratio · plateau · depth</span>
        </div>
        <div style={tableWrapStyle}>
          <div style={tableHeaderRowStyle}>
            <span>task</span>
            <span style={numColStyle}>thinking</span>
            <span style={numColStyle}>output</span>
            <span>ratio</span>
            <span>plateau</span>
            <span>depth</span>
          </div>
          {rows.map((r, i) => (
            <div
              key={r.task}
              style={{
                ...tableRowStyle,
                animation: `tb-row 420ms ${ENTRY_EASE} both`,
                animationDelay: `${80 + i * 18}ms`,
              }}
            >
              <span style={taskLabelStyle}>{TASK_KOREAN[r.task]}</span>
              <span style={numColStyle}>{fmtTokens(r.thinkingTokens)}</span>
              <span style={numColStyle}>{fmtTokens(r.outputTokens)}</span>
              <div style={ratioCellStyle}>
                <div style={ratioTrackStyle}>
                  <div
                    style={{
                      ...ratioFillStyle,
                      width: `${Math.round(r.thinkingRatio * 100)}%`,
                      background: r.thinkingRatio > 0.7 ? color.warn : color.accent,
                      animation: `tb-bar 540ms ${ENTRY_EASE} both`,
                      animationDelay: `${120 + i * 18}ms`,
                      transformOrigin: "left center",
                    }}
                  />
                </div>
                <span style={ratioPctStyle}>{Math.round(r.thinkingRatio * 100)}%</span>
              </div>
              <span>
                {r.plateauDetected ? (
                  <span style={plateauBadgeStyle}>plateau</span>
                ) : (
                  <span style={{ ...plateauBadgeStyle, ...plateauOkStyle }}>ok</span>
                )}
              </span>
              <span>
                <span style={{ ...depthChipStyle, color: DEPTH_COLOR[r.recommendedDepth], borderColor: DEPTH_COLOR[r.recommendedDepth] }}>
                  {DEPTH_LABEL[r.recommendedDepth]}
                </span>
              </span>
            </div>
          ))}
        </div>
      </section>

      <div style={bottomGridStyle}>
        {/* Stacked bars */}
        <section style={stackCardStyle}>
          <div style={cardHeadStyle}>
            <span style={cardTitleStyle}>thinking vs output — per task</span>
            <span style={cardSubStyle}>tokens absolute</span>
          </div>
          <div style={stackListStyle}>
            {rows.map((r, i) => {
              const total = r.thinkingTokens + r.outputTokens;
              const thinkPct = (r.thinkingTokens / total) * 100;
              const outPct = 100 - thinkPct;
              const rowWidth = (total / maxTotal) * 100;
              return (
                <div
                  key={r.task}
                  style={{
                    ...stackRowStyle,
                    animation: `tb-row 440ms ${ENTRY_EASE} both`,
                    animationDelay: `${140 + i * 22}ms`,
                  }}
                >
                  <span style={stackLabelStyle}>{TASK_KOREAN[r.task]}</span>
                  <div style={stackTrackStyle}>
                    <div
                      style={{
                        width: `${rowWidth}%`,
                        display: "flex",
                        height: "100%",
                        transformOrigin: "left center",
                        animation: `tb-bar 560ms ${ENTRY_EASE} both`,
                        animationDelay: `${180 + i * 22}ms`,
                      }}
                    >
                      <div style={{ width: `${thinkPct}%`, background: color.accent, height: "100%" }} />
                      <div style={{ width: `${outPct}%`, background: color.success, height: "100%", opacity: 0.75 }} />
                    </div>
                  </div>
                  <span style={stackTotalStyle}>{fmtTokens(total)}</span>
                </div>
              );
            })}
          </div>
          <div style={stackLegendStyle}>
            <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              <span style={{ ...legendDotStyle, background: color.accent }} /> thinking
            </span>
            <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
              <span style={{ ...legendDotStyle, background: color.success, opacity: 0.75 }} /> output
            </span>
          </div>
        </section>

        {/* Insight */}
        <aside style={insightCardStyle}>
          <div style={insightTitleStyle}>plateau detection</div>
          <div style={insightBodyStyle}>{insight}</div>
          <div style={insightRefStyle}>
            reasoning 모델은 task 난이도에 비례해 thinking tokens을 소모.
            plateau task는 shallow depth로 전환 시 정확도 손실 없이 비용
            20-40% 절감.
          </div>
        </aside>
      </div>
    </div>
  );
}

function HeroTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent: string;
}): ReactElement {
  return (
    <div style={heroTileStyle}>
      <div style={heroLabelStyle}>{label}</div>
      <div style={{ ...heroValueStyle, color: accent }}>{value}</div>
      <div style={heroSubStyle}>{sub}</div>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────

const rootStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  padding: `${space[5]}px ${space[6]}px`,
  background: color.bg0,
  boxSizing: "border-box",
  overflow: "auto",
  animation: `tb-enter ${ENTRY_MS}ms ${ENTRY_EASE} both`,
  fontFamily: font.sans,
  color: color.text0,
  display: "flex",
  flexDirection: "column",
  gap: space[4],
};

const emptyStyle: CSSProperties = {
  width: "100%",
  height: "100%",
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
};

const titleStyle: CSSProperties = {
  fontSize: font.size.xxl,
  fontWeight: font.weight.semibold,
  letterSpacing: font.letter.tight,
};

const subtitleStyle: CSSProperties = {
  fontSize: font.size.xs,
  color: color.text2,
  fontFamily: font.mono,
  marginTop: 2,
};

const heroStripStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: space[3],
};

const heroTileStyle: CSSProperties = {
  padding: space[3],
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  boxShadow: shadow.xs,
};

const heroLabelStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  fontWeight: font.weight.semibold,
};

const heroValueStyle: CSSProperties = {
  fontSize: 26,
  fontFamily: font.mono,
  fontWeight: font.weight.bold,
  lineHeight: 1.1,
  fontVariantNumeric: "tabular-nums",
  letterSpacing: -0.4,
  marginTop: 4,
};

const heroSubStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text3,
  fontFamily: font.mono,
  marginTop: 2,
};

const tableCardStyle: CSSProperties = {
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.lg,
  overflow: "hidden",
};

const cardHeadStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  padding: `${space[2]}px ${space[3]}px`,
  borderBottom: `1px solid ${color.border}`,
};

const cardTitleStyle: CSSProperties = {
  fontSize: font.size.sm,
  fontWeight: font.weight.semibold,
  color: color.text0,
};

const cardSubStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text3,
  fontFamily: font.mono,
};

const tableWrapStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
};

const tableHeaderRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "100px 90px 90px 1fr 90px 90px",
  alignItems: "center",
  gap: space[3],
  padding: `${space[2]}px ${space[4]}px`,
  fontSize: font.size.xxs,
  color: color.text2,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  fontWeight: font.weight.semibold,
  background: color.bg2,
};

const tableRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "100px 90px 90px 1fr 90px 90px",
  alignItems: "center",
  gap: space[3],
  padding: `${space[2]}px ${space[4]}px`,
  fontSize: font.size.sm,
  borderTop: `1px solid ${color.border}`,
};

const taskLabelStyle: CSSProperties = {
  fontWeight: font.weight.medium,
  color: color.text0,
};

const numColStyle: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.xs,
  color: color.text1,
  fontVariantNumeric: "tabular-nums",
};

const ratioCellStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[2],
};

const ratioTrackStyle: CSSProperties = {
  flex: 1,
  height: 6,
  background: color.bg3,
  borderRadius: radius.pill,
  overflow: "hidden",
};

const ratioFillStyle: CSSProperties = {
  height: "100%",
  borderRadius: radius.pill,
};

const ratioPctStyle: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.xxs,
  color: color.text1,
  width: 34,
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
};

const plateauBadgeStyle: CSSProperties = {
  display: "inline-block",
  padding: "2px 8px",
  fontSize: font.size.xxs,
  fontFamily: font.mono,
  fontWeight: font.weight.semibold,
  color: color.danger,
  background: "rgba(229,72,77,0.10)",
  border: `1px solid rgba(229,72,77,0.35)`,
  borderRadius: radius.pill,
};

const plateauOkStyle: CSSProperties = {
  color: color.success,
  background: "rgba(34,160,107,0.10)",
  border: `1px solid rgba(34,160,107,0.30)`,
};

const depthChipStyle: CSSProperties = {
  display: "inline-block",
  padding: "2px 8px",
  fontSize: font.size.xxs,
  fontFamily: font.mono,
  fontWeight: font.weight.semibold,
  background: color.bg0,
  border: `1px solid ${color.borderStrong}`,
  borderRadius: radius.pill,
};

const bottomGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 320px",
  gap: space[3],
};

const stackCardStyle: CSSProperties = {
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.lg,
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
};

const stackListStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  padding: space[3],
  gap: space[2],
};

const stackRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "100px 1fr 70px",
  alignItems: "center",
  gap: space[2],
};

const stackLabelStyle: CSSProperties = {
  fontSize: font.size.xs,
  color: color.text1,
  fontWeight: font.weight.medium,
};

const stackTrackStyle: CSSProperties = {
  height: 14,
  background: color.bg3,
  borderRadius: radius.xs,
  overflow: "hidden",
};

const stackTotalStyle: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.xxs,
  color: color.text2,
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
};

const stackLegendStyle: CSSProperties = {
  display: "flex",
  gap: space[4],
  padding: `0 ${space[3]}px ${space[3]}px`,
  fontSize: font.size.xxs,
  color: color.text2,
};

const legendDotStyle: CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: radius.xs,
};

const insightCardStyle: CSSProperties = {
  padding: space[3],
  background: color.accentSofter,
  border: `1px solid ${color.accentBorder}`,
  borderRadius: radius.lg,
  display: "flex",
  flexDirection: "column",
  gap: space[2],
};

const insightTitleStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.accent,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  fontWeight: font.weight.semibold,
};

const insightBodyStyle: CSSProperties = {
  fontSize: font.size.xs,
  color: color.text0,
  lineHeight: 1.5,
};

const insightRefStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  fontFamily: font.mono,
  lineHeight: 1.45,
};

export const ThinkingBudgetView = memo(ThinkingBudgetViewImpl);
