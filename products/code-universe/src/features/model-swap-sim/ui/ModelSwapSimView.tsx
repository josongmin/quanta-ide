// ModelSwapSimView — per-file, per-task model-swap impact.
// --------------------------------------------------------------------
// Top: 2 model-picker chip rows, From / To. Middle: 6-task table — task,
// current success %, swap success %, Δ, current cost, swap cost, Δ cost,
// recommendation (safe-swap / risky-swap / do-not-swap). Bottom: total
// summary. Right: scatter — X = success Δ, Y = cost Δ, "sweet spot"
// quadrant = positive cost saving + minimal success drop.
//
// Reference: Chen et al. "RouteLLM" 2024; Ding et al. "FrugalGPT" 2023;
// model-deprecation dependency risk 2025.

import { memo, useMemo, useState } from "react";
import type { CSSProperties, ReactElement } from "react";

import type { Entity } from "@quanta/canvas-engine";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, shadow, space, transition } from "../../../shared/ui/tokens";
import {
  modelSwapSim,
  type AIModel,
  type AITaskKind,
  type ModelSwapImpact,
} from "../../../shared/analytics/synth-metrics";

export interface ModelSwapSimViewProps {
  ctx: ViewContextValue;
  entity?: Entity;
  empty?: boolean;
}

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 520;
const STAGGER_MS = 16;

const KEYFRAMES = `
@keyframes ms-enter { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
@keyframes ms-tile  { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
@keyframes ms-row   { from { opacity: 0; transform: translateX(-4px); } to { opacity: 1; transform: translateX(0); } }
@keyframes ms-dot   { from { opacity: 0; transform: scale(0.4); } to { opacity: 1; transform: scale(1); } }
`;

const TASK_KOREAN: Record<AITaskKind, string> = {
  explain: "설명",
  "fix-bug": "버그 수정",
  "add-feature": "기능 추가",
  refactor: "리팩터",
  test: "테스트 작성",
  review: "코드 리뷰",
};

const MODEL_LABEL: Record<AIModel, string> = {
  "claude-opus-4-7":   "Claude Opus 4.7",
  "claude-sonnet-4-6": "Claude Sonnet 4.6",
  "gpt-5":             "GPT-5",
  "gpt-5-mini":        "GPT-5 mini",
  "gemini-2.5-pro":    "Gemini 2.5 Pro",
};

const MODEL_ORDER: readonly AIModel[] = [
  "claude-opus-4-7",
  "claude-sonnet-4-6",
  "gpt-5",
  "gpt-5-mini",
  "gemini-2.5-pro",
];

function fmtCost(usd: number): string {
  if (usd < 0.01) return "<$0.01";
  if (usd >= 100) return `$${usd.toFixed(0)}`;
  return `$${usd.toFixed(2)}`;
}

function fmtCostDelta(usd: number): string {
  const sign = usd > 0 ? "+" : "";
  if (Math.abs(usd) < 0.01) return "±$0.00";
  if (Math.abs(usd) >= 100) return `${sign}$${usd.toFixed(0)}`;
  return `${sign}$${usd.toFixed(2)}`;
}

function recColor(r: ModelSwapImpact["recommendation"]): string {
  if (r === "safe-swap") return color.success;
  if (r === "risky-swap") return color.warn;
  return color.danger;
}

function ModelSwapSimViewImpl({ ctx, entity, empty }: ModelSwapSimViewProps): ReactElement {
  const [from, setFrom] = useState<AIModel>("claude-sonnet-4-6");
  const [to, setTo] = useState<AIModel>("gpt-5-mini");

  const edges = ctx.graph?.fileEdges;
  const impacts = useMemo<ModelSwapImpact[] | null>(() => {
    if (!entity || !ctx.tree) return null;
    return modelSwapSim(entity, ctx.tree, edges, from, to);
  }, [entity, ctx.tree, edges, from, to]);

  if (empty || !entity || !ctx.tree || !impacts) {
    return (
      <div style={rootStyle}>
        <style>{KEYFRAMES}</style>
        <div style={emptyStyle}>파일을 선택하세요.</div>
      </div>
    );
  }

  const successDrop = impacts.reduce((a, r) => a + Math.max(0, -r.deltaSuccess), 0) / impacts.length;
  const totalCurrent = impacts.reduce((a, r) => a + r.currentCost, 0);
  const totalSwapped = impacts.reduce((a, r) => a + r.swappedCost, 0);
  const monthlyFactor = 30; // synthesize monthly from daily-task estimate
  const monthlySaving = (totalCurrent - totalSwapped) * monthlyFactor;
  const safeCount = impacts.filter(i => i.recommendation === "safe-swap").length;
  const doNotCount = impacts.filter(i => i.recommendation === "do-not-swap").length;

  const successDeltas = impacts.map(i => i.deltaSuccess);
  const costDeltas = impacts.map(i => i.deltaCost);
  const maxAbsSuccess = Math.max(0.05, ...successDeltas.map(Math.abs));
  const maxAbsCost = Math.max(0.01, ...costDeltas.map(Math.abs));

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>

      <header style={headerStyle}>
        <div>
          <div style={titleStyle}>
            Model Swap ·{" "}
            <span style={{ color: color.accent, fontWeight: font.weight.semibold }}>
              {entity.name}
            </span>
          </div>
          <div style={subtitleStyle}>
            per-task success × cost trade-off · {impacts.length} tasks
          </div>
        </div>
        <div style={refStyle}>
          Chen "RouteLLM" 2024 · Ding "FrugalGPT" 2023 · 모델 deprecation 2025
        </div>
      </header>

      {/* Model pickers */}
      <section style={pickerRow}>
        <ModelPicker
          label="From"
          current={from}
          onChange={setFrom}
          delayBase={0}
        />
        <div style={swapIcon}>⇌</div>
        <ModelPicker
          label="To"
          current={to}
          onChange={setTo}
          delayBase={4}
        />
      </section>

      {/* Task table + scatter */}
      <section style={bodyGrid}>
        <div style={tableWrap}>
          <div style={scatterHead}>
            <span style={sectionHead}>Per-task impact</span>
            <span style={mutedMono}>
              {MODEL_LABEL[from]} → {MODEL_LABEL[to]}
            </span>
          </div>
          <div style={listStyle}>
            <div style={listHeader}>
              <span style={{ ...headCell, flex: 1 }}>task</span>
              <span style={{ ...headCell, width: 66, textAlign: "right" }}>curr %</span>
              <span style={{ ...headCell, width: 66, textAlign: "right" }}>swap %</span>
              <span style={{ ...headCell, width: 60, textAlign: "right" }}>Δ %</span>
              <span style={{ ...headCell, width: 70, textAlign: "right" }}>curr $</span>
              <span style={{ ...headCell, width: 70, textAlign: "right" }}>swap $</span>
              <span style={{ ...headCell, width: 66, textAlign: "right" }}>Δ $</span>
              <span style={{ ...headCell, width: 104 }}>verdict</span>
            </div>
            {impacts.map((r, i) => {
              const deltaPctPts = r.deltaSuccess * 100;
              const pctTint = deltaPctPts >= 0 ? color.success : color.danger;
              const costTint = r.deltaCost <= 0 ? color.success : color.danger;
              return (
                <div
                  key={r.task}
                  style={{
                    ...fileRow,
                    animationDelay: `${160 + i * STAGGER_MS}ms`,
                  }}
                >
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={rowName}>{TASK_KOREAN[r.task]}</span>
                    <span style={rowPath}>{r.task}</span>
                  </span>
                  <span style={{ ...cellNum, width: 66 }}>
                    {(r.currentSuccess * 100).toFixed(0)}
                  </span>
                  <span style={{ ...cellNum, width: 66 }}>
                    {(r.swappedSuccess * 100).toFixed(0)}
                  </span>
                  <span style={{ ...cellNum, width: 60, color: pctTint, fontWeight: font.weight.bold }}>
                    {deltaPctPts >= 0 ? "+" : ""}
                    {deltaPctPts.toFixed(1)}
                  </span>
                  <span style={{ ...cellNum, width: 70 }}>{fmtCost(r.currentCost)}</span>
                  <span style={{ ...cellNum, width: 70 }}>{fmtCost(r.swappedCost)}</span>
                  <span style={{ ...cellNum, width: 66, color: costTint, fontWeight: font.weight.bold }}>
                    {fmtCostDelta(r.deltaCost)}
                  </span>
                  <span style={{ width: 104, display: "flex", justifyContent: "flex-end" }}>
                    <RecPill rec={r.recommendation} />
                  </span>
                </div>
              );
            })}
          </div>

          {/* Summary */}
          <div
            style={{
              ...summaryStyle,
              animationDelay: `${160 + impacts.length * STAGGER_MS + 80}ms`,
            }}
          >
            <span style={summaryLead}>
              {impacts.length} tasks combined:
            </span>
            <span style={summaryBody}>
              swap saves{" "}
              <span
                style={{
                  color: monthlySaving >= 0 ? color.success : color.danger,
                  fontFamily: font.mono,
                  fontWeight: font.weight.bold,
                }}
              >
                {fmtCostDelta(-monthlySaving)}/month
              </span>
              {" "}with{" "}
              <span
                style={{
                  color: successDrop > 0.01 ? color.warn : color.success,
                  fontFamily: font.mono,
                  fontWeight: font.weight.bold,
                }}
              >
                {(successDrop * 100).toFixed(1)}% avg success drop
              </span>
              {" "}— {safeCount} safe, {doNotCount} do-not-swap.
            </span>
          </div>
        </div>

        <aside style={sidebar}>
          <div style={sidebarHead}>
            <span style={sectionHead}>Sweet-spot scatter</span>
            <span style={mutedMono}>Δ success × Δ cost</span>
          </div>
          <div style={{ padding: space[3] }}>
            <ImpactScatter
              impacts={impacts}
              maxAbsSuccess={maxAbsSuccess}
              maxAbsCost={maxAbsCost}
            />
          </div>
        </aside>
      </section>
    </div>
  );
}

function ModelPicker({
  label, current, onChange, delayBase,
}: {
  label: string;
  current: AIModel;
  onChange: (m: AIModel) => void;
  delayBase: number;
}): ReactElement {
  return (
    <div style={pickerPanel}>
      <div style={pickerLabel}>{label}</div>
      <div style={pickerChips}>
        {MODEL_ORDER.map((m, i) => {
          const active = m === current;
          return (
            <button
              key={m}
              type="button"
              onClick={() => onChange(m)}
              style={{
                ...chipStyle,
                background: active ? color.accentSoft : color.bg1,
                borderColor: active ? color.accentBorder : color.border,
                color: active ? color.accent : color.text1,
                fontWeight: active ? font.weight.semibold : font.weight.medium,
                animationDelay: `${(delayBase + i) * STAGGER_MS}ms`,
              }}
            >
              {MODEL_LABEL[m]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RecPill({ rec }: { rec: ModelSwapImpact["recommendation"] }): ReactElement {
  const tint = recColor(rec);
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
        minWidth: 92,
        textAlign: "center",
      }}
    >
      {rec}
    </span>
  );
}

function ImpactScatter({
  impacts, maxAbsSuccess, maxAbsCost,
}: {
  impacts: ModelSwapImpact[];
  maxAbsSuccess: number;
  maxAbsCost: number;
}): ReactElement {
  const W = 300;
  const H = 240;
  const PL = 42;
  const PR = 10;
  const PT = 14;
  const PB = 30;
  const innerW = W - PL - PR;
  const innerH = H - PT - PB;

  const cx0 = PL + innerW / 2; // zero X
  const cy0 = PT + innerH / 2; // zero Y

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="impact scatter">
      {/* Sweet-spot quadrant (positive Δ success, negative Δ cost = bottom-right in Y-cost-up) */}
      <rect
        x={cx0}
        y={cy0}
        width={innerW / 2}
        height={innerH / 2}
        fill={color.success}
        opacity={0.08}
      />
      <text
        x={PL + innerW - 4}
        y={cy0 + 14}
        textAnchor="end"
        fontSize={font.size.xxs}
        fill={color.success}
        fontFamily={font.sans}
        fontStyle="italic"
      >
        sweet spot
      </text>

      {/* Axes */}
      <line x1={PL} y1={cy0} x2={PL + innerW} y2={cy0} stroke={color.borderStrong} strokeWidth={1} />
      <line x1={cx0} y1={PT} x2={cx0} y2={PT + innerH} stroke={color.borderStrong} strokeWidth={1} />

      {/* Ticks */}
      {[-1, -0.5, 0.5, 1].map(t => {
        const x = cx0 + t * (innerW / 2);
        const y = cy0 + t * (innerH / 2);
        return (
          <g key={`tick-${t}`}>
            <line x1={x} y1={PT} x2={x} y2={PT + innerH} stroke={color.border} strokeDasharray="3 4" strokeOpacity={0.45} />
            <line x1={PL} y1={y} x2={PL + innerW} y2={y} stroke={color.border} strokeDasharray="3 4" strokeOpacity={0.45} />
          </g>
        );
      })}

      {/* Dots */}
      {impacts.map((r, i) => {
        const sx = cx0 + (r.deltaSuccess / maxAbsSuccess) * (innerW / 2);
        // Y axis: cost delta, positive = up (more expensive). We INVERT so
        // savings (negative Δ) appear DOWN = bottom, matching "sweet spot"
        // message. Actually want: delta cost positive → up = bad.
        const sy = cy0 - (r.deltaCost / maxAbsCost) * (innerH / 2);
        const tint = recColor(r.recommendation);
        return (
          <g
            key={r.task}
            style={{
              animation: `ms-dot 520ms ${ENTRY_EASE} both`,
              animationDelay: `${200 + i * STAGGER_MS}ms`,
            }}
          >
            <circle cx={sx} cy={sy} r={6} fill={tint} opacity={0.8} />
            <text
              x={sx + 9}
              y={sy + 3}
              fontFamily={font.mono}
              fontSize={font.size.xxs}
              fill={color.text1}
            >
              {TASK_KOREAN[r.task]}
            </text>
          </g>
        );
      })}

      {/* Axis labels */}
      <text
        x={PL + innerW / 2}
        y={H - 4}
        textAnchor="middle"
        fontSize={font.size.xxs}
        fill={color.text2}
        fontFamily={font.sans}
      >
        Δ success →
      </text>
      <text
        x={0} y={0}
        textAnchor="middle"
        fontSize={font.size.xxs}
        fill={color.text2}
        fontFamily={font.sans}
        transform={`translate(14, ${PT + innerH / 2}) rotate(-90)`}
      >
        Δ cost ↑
      </text>
    </svg>
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
  animation: `ms-enter ${ENTRY_MS}ms ${ENTRY_EASE} both`,
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

const pickerRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto 1fr",
  gap: space[3],
  alignItems: "center",
  marginBottom: space[5],
};

const swapIcon: CSSProperties = {
  fontFamily: font.mono,
  fontSize: 28,
  color: color.accent,
  textAlign: "center",
  padding: `0 ${space[2]}px`,
};

const pickerPanel: CSSProperties = {
  padding: space[3],
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  boxShadow: shadow.xs,
};

const pickerLabel: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  fontWeight: font.weight.semibold,
  marginBottom: space[2],
};

const pickerChips: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: space[1],
};

const chipStyle: CSSProperties = {
  padding: `6px 12px`,
  borderRadius: radius.pill,
  fontSize: font.size.xs,
  cursor: "pointer",
  border: `1px solid ${color.border}`,
  background: color.bg1,
  color: color.text1,
  transition: `all ${transition.base}`,
  fontFamily: font.sans,
  animation: `ms-tile 420ms ${ENTRY_EASE} both`,
};

const bodyGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) 340px",
  gap: space[4],
};

const tableWrap: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: space[2],
};

const scatterHead: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
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
};

const sidebarHead: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: `${space[3]}px ${space[4]}px`,
  borderBottom: `1px solid ${color.border}`,
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
  borderBottom: `1px solid ${color.borderSoft}`,
  textAlign: "left",
  animation: `ms-row 440ms ${ENTRY_EASE} both`,
};

const cellNum: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.xs,
  color: color.text1,
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
};

const rowName: CSSProperties = {
  fontSize: font.size.sm,
  color: color.text0,
  fontWeight: font.weight.medium,
  display: "block",
};

const rowPath: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text3,
  fontFamily: font.mono,
  display: "block",
};

const summaryStyle: CSSProperties = {
  marginTop: space[3],
  padding: `${space[3]}px ${space[4]}px`,
  background: color.accentSofter,
  border: `1px solid ${color.accentBorder}`,
  borderRadius: radius.md,
  fontSize: font.size.md,
  color: color.text0,
  lineHeight: 1.5,
  animation: `ms-tile 460ms ${ENTRY_EASE} both`,
};

const summaryLead: CSSProperties = {
  fontWeight: font.weight.semibold,
  color: color.accent,
  marginRight: space[2],
};

const summaryBody: CSSProperties = {
  color: color.text1,
};

export const ModelSwapSimView = memo(ModelSwapSimViewImpl);
