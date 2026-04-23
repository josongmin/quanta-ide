// CounterfactualView — "if X instead of Y" scenario cards.
// --------------------------------------------------------------------
// Top: selected file + subtitle explaining the surface.
// Middle: 3-5 scenario cards. Each card shows the original prompt
//         (quoted neutral) and the variant (quoted with contrast
//         tint), the predicted outcome paragraph, a confidence delta
//         chip (+X% / -Y%) and a one-line delta-reasoning subtitle.
// Bottom: "why counterfactuals help" info card explaining the
//         explainability rationale.
//
// Reference: Miller AI Journal 2019 · Wachter et al. 2018 · LLM
// counterfactual reasoning 2024.

import { memo, useMemo } from "react";
import type { CSSProperties, ReactElement } from "react";

import type { Entity } from "@quanta/canvas-engine";
import { color, font, radius, shadow, space } from "../../../shared/ui/tokens";
import {
  counterfactualPrompts,
  type CounterfactualScenario,
} from "../../../shared/analytics/synth-metrics";

interface Props {
  entity?: Entity;
  empty?: boolean;
}

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 520;
const STAGGER_MS = 22;

const KEYFRAMES = `
@keyframes cf-enter { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
@keyframes cf-slide { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
`;

function fmtDelta(d: number): string {
  const pct = Math.round(d * 100);
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct}%`;
}

function deltaColor(d: number): string {
  if (d > 0.02) return color.success;
  if (d < -0.15) return color.danger;
  if (d < -0.05) return color.warn;
  return color.text2;
}

function CounterfactualViewImpl({ entity, empty }: Props): ReactElement {
  const scenarios = useMemo<CounterfactualScenario[]>(
    () => (entity ? counterfactualPrompts(entity) : []),
    [entity],
  );

  if (empty || !entity) {
    return (
      <div style={rootStyle}>
        <style>{KEYFRAMES}</style>
        <div style={emptyStyle}>파일을 선택하세요.</div>
      </div>
    );
  }

  const avgDelta =
    scenarios.length === 0
      ? 0
      : scenarios.reduce((a, s) => a + s.confidenceDelta, 0) / scenarios.length;

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>

      <header style={headerStyle}>
        <div>
          <div style={titleStyle}>
            Counterfactual · <span style={{ color: color.text1, fontWeight: font.weight.medium }}>{entity.name}</span>
          </div>
          <div style={subtitleStyle}>
            {entity.path} · auto-generated counterfactual scenarios — based on
            recent prompt patterns
          </div>
        </div>
        <div style={{ fontFamily: font.mono, fontSize: font.size.xxs, color: color.text3 }}>
          Miller 2019 · Wachter 2018 · LLM CF 2024
        </div>
      </header>

      {/* Summary strip */}
      <div style={summaryStripStyle}>
        <div style={summaryTileStyle}>
          <span style={summaryLabelStyle}>scenarios</span>
          <span style={summaryValueStyle}>{scenarios.length}</span>
        </div>
        <div style={summaryTileStyle}>
          <span style={summaryLabelStyle}>avg confidence Δ</span>
          <span style={{ ...summaryValueStyle, color: deltaColor(avgDelta) }}>
            {fmtDelta(avgDelta)}
          </span>
        </div>
        <div style={summaryTileStyle}>
          <span style={summaryLabelStyle}>largest swing</span>
          <span
            style={{
              ...summaryValueStyle,
              color: deltaColor(
                scenarios.reduce((m, s) => (Math.abs(s.confidenceDelta) > Math.abs(m) ? s.confidenceDelta : m), 0),
              ),
            }}
          >
            {fmtDelta(
              scenarios.reduce((m, s) => (Math.abs(s.confidenceDelta) > Math.abs(m) ? s.confidenceDelta : m), 0),
            )}
          </span>
        </div>
        <div style={summaryTileStyle}>
          <span style={summaryLabelStyle}>sensitive framings</span>
          <span style={summaryValueStyle}>
            {scenarios.filter(s => Math.abs(s.confidenceDelta) > 0.2).length}
          </span>
        </div>
      </div>

      <section style={scenarioGridStyle}>
        {scenarios.map((s, i) => (
          <ScenarioCard key={s.id} scenario={s} index={i} />
        ))}
      </section>

      <div style={rationaleCardStyle}>
        <div style={rationaleTitleStyle}>why counterfactuals help</div>
        <div style={rationaleBodyStyle}>
          에이전트의 추론 과정은 불투명합니다 — 출력만 보고는 왜 이 선택을
          했는지 알기 어렵습니다. 대조 가정 (counterfactual) query를 나란히
          놓으면 모델의 decision boundary가 드러나고, 어떤 framing에 민감한지
          (swing이 큰 variant) 를 빠르게 식별할 수 있습니다.
        </div>
        <div style={rationaleRefStyle}>
          "contrastive explanations are the natural form of human explanation"
          — Miller 2019. 단일 결정 설명보다 대조 쌍이 더 informative.
        </div>
      </div>
    </div>
  );
}

function ScenarioCard({
  scenario,
  index,
}: {
  scenario: CounterfactualScenario;
  index: number;
}): ReactElement {
  const dColor = deltaColor(scenario.confidenceDelta);
  return (
    <article
      style={{
        ...cardStyle,
        animation: `cf-slide 560ms ${ENTRY_EASE} both`,
        animationDelay: `${120 + index * STAGGER_MS}ms`,
      }}
    >
      <div style={cardHeadRowStyle}>
        <span style={cardIndexStyle}>CF #{index + 1}</span>
        <span
          style={{
            ...deltaChipStyle,
            color: dColor,
            borderColor: dColor,
            background: "rgba(255,255,255,0.6)",
          }}
        >
          confidence Δ {fmtDelta(scenario.confidenceDelta)}
        </span>
      </div>

      <div style={quoteBlockStyle}>
        <span style={quoteLabelStyle}>original</span>
        <blockquote style={originalQuoteStyle}>
          <span style={quoteMarkStyle}>“</span>
          {scenario.originalPrompt}
          <span style={quoteMarkStyle}>”</span>
        </blockquote>
      </div>

      <div style={{ ...quoteBlockStyle, marginTop: space[2] }}>
        <span style={{ ...quoteLabelStyle, color: color.accent }}>
          if instead
        </span>
        <blockquote style={variantQuoteStyle}>
          <span style={quoteMarkStyle}>“</span>
          {scenario.variant}
          <span style={quoteMarkStyle}>”</span>
        </blockquote>
      </div>

      <div style={outcomeSectionStyle}>
        <span style={outcomeLabelStyle}>predicted outcome</span>
        <p style={outcomeBodyStyle}>{scenario.predictedOutcome}</p>
      </div>

      <div style={reasoningStripStyle}>
        <span style={reasoningLabelStyle}>delta reasoning</span>
        <span style={reasoningBodyStyle}>{scenario.deltaReasoning}</span>
      </div>
    </article>
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
  animation: `cf-enter ${ENTRY_MS}ms ${ENTRY_EASE} both`,
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

const summaryStripStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: space[3],
};

const summaryTileStyle: CSSProperties = {
  padding: `${space[2]}px ${space[3]}px`,
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  boxShadow: shadow.xs,
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

const summaryLabelStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  fontWeight: font.weight.semibold,
};

const summaryValueStyle: CSSProperties = {
  fontSize: 22,
  fontFamily: font.mono,
  fontWeight: font.weight.bold,
  fontVariantNumeric: "tabular-nums",
  letterSpacing: -0.4,
  color: color.text0,
};

const scenarioGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: space[3],
};

const cardStyle: CSSProperties = {
  padding: space[4],
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.lg,
  boxShadow: shadow.xs,
  display: "flex",
  flexDirection: "column",
  gap: space[2],
};

const cardHeadRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: space[2],
};

const cardIndexStyle: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.xxs,
  color: color.text3,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
};

const deltaChipStyle: CSSProperties = {
  display: "inline-block",
  padding: "2px 10px",
  fontSize: font.size.xxs,
  fontFamily: font.mono,
  fontWeight: font.weight.semibold,
  border: `1px solid`,
  borderRadius: radius.pill,
  fontVariantNumeric: "tabular-nums",
};

const quoteBlockStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const quoteLabelStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  fontWeight: font.weight.semibold,
};

const originalQuoteStyle: CSSProperties = {
  margin: 0,
  padding: `${space[2]}px ${space[3]}px`,
  background: color.bg2,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  fontFamily: font.mono,
  fontSize: font.size.xs,
  color: color.text1,
  lineHeight: 1.5,
};

const variantQuoteStyle: CSSProperties = {
  margin: 0,
  padding: `${space[2]}px ${space[3]}px`,
  background: color.accentSofter,
  border: `1px solid ${color.accentBorder}`,
  borderRadius: radius.md,
  fontFamily: font.mono,
  fontSize: font.size.xs,
  color: color.text0,
  lineHeight: 1.5,
};

const quoteMarkStyle: CSSProperties = {
  color: color.text3,
  marginInline: 2,
};

const outcomeSectionStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  marginTop: space[1],
};

const outcomeLabelStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  fontWeight: font.weight.semibold,
};

const outcomeBodyStyle: CSSProperties = {
  margin: 0,
  fontSize: font.size.sm,
  color: color.text0,
  lineHeight: 1.55,
};

const reasoningStripStyle: CSSProperties = {
  marginTop: space[1],
  paddingTop: space[2],
  borderTop: `1px solid ${color.borderSoft}`,
  display: "flex",
  gap: space[2],
  alignItems: "baseline",
};

const reasoningLabelStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text3,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  fontWeight: font.weight.semibold,
  flex: "0 0 auto",
};

const reasoningBodyStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  fontFamily: font.mono,
  lineHeight: 1.45,
};

const rationaleCardStyle: CSSProperties = {
  padding: space[4],
  background: color.bg2,
  border: `1px solid ${color.border}`,
  borderRadius: radius.lg,
  display: "flex",
  flexDirection: "column",
  gap: space[2],
};

const rationaleTitleStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text1,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  fontWeight: font.weight.semibold,
};

const rationaleBodyStyle: CSSProperties = {
  fontSize: font.size.sm,
  color: color.text0,
  lineHeight: 1.6,
};

const rationaleRefStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  fontFamily: font.mono,
  lineHeight: 1.45,
};

export const CounterfactualView = memo(CounterfactualViewImpl);
