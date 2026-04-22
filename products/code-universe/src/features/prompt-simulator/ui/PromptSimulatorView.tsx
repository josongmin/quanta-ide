// PromptSimulatorView — interactive per-task prompt cost simulator.
// --------------------------------------------------------------------
// Pick a task (설명 / 버그 수정 / 기능 추가 / 리팩터 / 테스트 작성 /
// 코드 리뷰). The simulator reads the selected file, runs it through
// `estimateTaskCost` (which pulls its hop-depth + output-ratio from the
// task kind) and renders:
//   ▸ a hero row for Claude Sonnet 4.6 (the primary 2026 workhorse):
//     input tokens · output tokens · USD cost — all rAF-animated 0→target
//     so the viewer FEELS the number land.
//   ▸ a table of all 5 supported models for THIS task, with Sonnet
//     highlighted.
//   ▸ a context-strategy explanation on the right (what files are in the
//     context window, at what hop depth, how many files total).
//   ▸ a savings-potential card computed from `contextFootprint`'s
//     `minimumViable` (interface-only) estimate — the single biggest
//     lever for cost reduction in 2026 agent workflows.
//   ▸ a bottom comparison bar: the SAME target across all 6 tasks so the
//     user can see "refactor is 8× more expensive than explain".
//
// Reference: Anthropic / OpenAI context engineering best practices 2025;
// "Prompt Budget" as a novel framing of inference cost per task.

import { memo, useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import type { Entity } from "@quanta/canvas-engine";
import {
  color as tokenColor,
  font,
  radius as radiusToken,
  space,
} from "../../../shared/ui/tokens";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import {
  AI_PRICING,
  AI_TASK_KINDS,
  computeCost,
  contextFootprint,
  estimateTaskCost,
  fileTokens,
  type AIModel,
  type AITaskKind,
  type TaskCostEstimate,
} from "../../../shared/analytics/synth-metrics";

export interface PromptSimulatorViewProps {
  ctx: ViewContextValue;
  entity?: Entity;
  empty?: boolean;
}

const PRIMARY_MODEL: AIModel = "claude-sonnet-4-6";

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 520;
const STAGGER_MS = 18;
const COUNTER_MS = 640;

const KEYFRAMES = `
@keyframes psFadeIn {
  from { opacity: 0; transform: scale(0.98); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes psRowIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes psBarGrow {
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
}
`;

const TASK_LABELS: Record<AITaskKind, string> = {
  explain: "설명",
  "fix-bug": "버그 수정",
  "add-feature": "기능 추가",
  refactor: "리팩터",
  test: "테스트 작성",
  review: "코드 리뷰",
};

const MODEL_LABEL: Record<AIModel, string> = {
  "claude-sonnet-4-6": "Claude Sonnet 4.6",
  "claude-opus-4-7":   "Claude Opus 4.7",
  "gpt-5":             "GPT-5",
  "gpt-5-mini":        "GPT-5 mini",
  "gemini-2.5-pro":    "Gemini 2.5 Pro",
};

const MODEL_ORDER: readonly AIModel[] = [
  "claude-sonnet-4-6",
  "claude-opus-4-7",
  "gpt-5",
  "gpt-5-mini",
  "gemini-2.5-pro",
];

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

function fmtCost(usd: number): string {
  if (usd < 0.01) return "<$0.01";
  if (usd >= 100) return `$${usd.toFixed(0)}`;
  return `$${usd.toFixed(2)}`;
}

/** rAF interpolated counter 0→target, ease-out cubic. Resets on target change. */
function useCounter(target: number, durationMs: number): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (target - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return value;
}

function breadcrumbFor(entity: Entity, tree: NonNullable<ViewContextValue["tree"]>): string {
  const parts = tree.ancestorsOf(entity.id).map(e => e.name);
  return parts.join(" / ");
}

function PromptSimulatorViewImpl({
  ctx,
  entity,
  empty,
}: PromptSimulatorViewProps): ReactElement {
  const [task, setTask] = useState<AITaskKind>("fix-bug");

  const width = Math.max(1, ctx.viewportSize.w);
  const height = Math.max(1, ctx.viewportSize.h);

  // Always define hooks at the top level — derive-or-fallback below.
  const edges = ctx.graph?.fileEdges;

  const estimate = useMemo<TaskCostEstimate | null>(() => {
    if (!entity || !ctx.tree) return null;
    return estimateTaskCost(entity, ctx.tree, edges, task);
  }, [entity, ctx.tree, edges, task]);

  const minimumViable = useMemo(() => {
    if (!entity || !ctx.tree) return null;
    const fp = contextFootprint(entity, ctx.tree, edges, 0);
    return fp.minimumViable;
  }, [entity, ctx.tree, edges]);

  const allTaskEstimates = useMemo<Record<AITaskKind, TaskCostEstimate> | null>(() => {
    if (!entity || !ctx.tree) return null;
    const out = {} as Record<AITaskKind, TaskCostEstimate>;
    for (const t of AI_TASK_KINDS) {
      out[t] = estimateTaskCost(entity, ctx.tree, edges, t);
    }
    return out;
  }, [entity, ctx.tree, edges]);

  const inputAnim = useCounter(estimate?.inputTokens ?? 0, COUNTER_MS);
  const outputAnim = useCounter(estimate?.outputTokens ?? 0, COUNTER_MS);
  const costAnim = useCounter(estimate?.costUsd[PRIMARY_MODEL] ?? 0, COUNTER_MS);

  if (empty || !entity || !ctx.tree || !estimate || !allTaskEstimates || minimumViable == null) {
    return (
      <div
        style={{
          width,
          height,
          background: tokenColor.bg0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: space[2],
          fontFamily: font.sans,
        }}
      >
        <style>{KEYFRAMES}</style>
        <div
          style={{
            fontSize: font.size.md,
            color: tokenColor.text2,
          }}
        >
          파일을 선택하세요.
        </div>
        <div
          style={{
            fontSize: font.size.xs,
            color: tokenColor.text3,
          }}
        >
          선택된 파일에 대해 6개의 task별 prompt 비용을 시뮬레이션합니다.
        </div>
      </div>
    );
  }

  const breadcrumb = breadcrumbFor(entity, ctx.tree);
  const selfTokens = fileTokens(entity);
  const savedTokens = Math.max(0, estimate.inputTokens - minimumViable);
  const savedPct = estimate.inputTokens > 0
    ? (savedTokens / estimate.inputTokens) * 100
    : 0;
  const minCost = computeCost(minimumViable, estimate.outputTokens)[PRIMARY_MODEL];

  // Sort models in fixed order (Sonnet first).
  const modelsInOrder = MODEL_ORDER;

  // For the comparison bar: max input tokens across tasks for normalization.
  const maxInput = Math.max(
    ...AI_TASK_KINDS.map(t => allTaskEstimates[t].inputTokens),
  );
  const maxOutput = Math.max(
    ...AI_TASK_KINDS.map(t => allTaskEstimates[t].outputTokens),
  );

  return (
    <div
      style={{
        width,
        height,
        background: tokenColor.bg0,
        fontFamily: font.sans,
        color: tokenColor.text0,
        overflowY: "auto",
        boxSizing: "border-box",
        padding: `${space[5]}px ${space[6]}px`,
        animation: `psFadeIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
      }}
    >
      <style>{KEYFRAMES}</style>

      {/* Header */}
      <div style={{ marginBottom: space[4] }}>
        <div
          style={{
            fontSize: font.size.display,
            fontWeight: font.weight.semibold,
            letterSpacing: font.letter.tight,
          }}
        >
          Prompt Simulator
        </div>
        <div
          style={{
            fontSize: font.size.xs,
            color: tokenColor.text2,
            marginTop: 2,
          }}
        >
          태스크별 비용 예측 — Anthropic / OpenAI context engineering 2025 · "Prompt Budget"
        </div>
      </div>

      {/* Top row: Task picker + target selection */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: space[3],
          marginBottom: space[4],
        }}
      >
        {/* Task picker */}
        <div style={panelStyle}>
          <div style={panelLabelStyle}>Task</div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: space[1],
              marginTop: space[2],
            }}
          >
            {AI_TASK_KINDS.map(t => {
              const active = t === task;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTask(t)}
                  style={{
                    padding: `${space[1]}px ${space[3]}px`,
                    borderRadius: radiusToken.pill,
                    border: `1px solid ${active ? tokenColor.accentBorder : tokenColor.border}`,
                    background: active ? tokenColor.accentSoft : tokenColor.bg1,
                    color: active ? tokenColor.accent : tokenColor.text1,
                    fontSize: font.size.sm,
                    fontWeight: active ? font.weight.semibold : font.weight.medium,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    transition: "background 160ms ease-out, color 160ms ease-out, border-color 160ms ease-out",
                  }}
                >
                  {TASK_LABELS[t]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Target file */}
        <div style={panelStyle}>
          <div style={panelLabelStyle}>Target file</div>
          <div
            style={{
              marginTop: space[2],
              display: "flex",
              alignItems: "center",
              gap: space[2],
              justifyContent: "space-between",
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: font.size.md,
                  fontWeight: font.weight.semibold,
                  color: tokenColor.text0,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {entity.name}
              </div>
              <div
                style={{
                  fontSize: font.size.xxs,
                  color: tokenColor.text3,
                  fontFamily: font.mono,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  marginTop: 2,
                }}
                title={breadcrumb}
              >
                {breadcrumb}
              </div>
            </div>
            <button
              type="button"
              onClick={() => ctx.dispatch.selectEntity(entity.id)}
              style={{
                padding: `${space[1]}px ${space[3]}px`,
                borderRadius: radiusToken.sm,
                border: `1px solid ${tokenColor.border}`,
                background: tokenColor.bg1,
                color: tokenColor.text1,
                fontSize: font.size.xs,
                cursor: "pointer",
                fontFamily: "inherit",
                whiteSpace: "nowrap",
              }}
            >
              Change file
            </button>
          </div>
          <div
            style={{
              marginTop: space[2],
              fontSize: font.size.xxs,
              color: tokenColor.text3,
              fontFamily: font.mono,
            }}
          >
            self: {fmtTokens(selfTokens)} tok · ctx: {estimate.filesNeeded} files
          </div>
        </div>
      </div>

      {/* Middle: hero + context strategy side panel */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 320px",
          gap: space[3],
          marginBottom: space[4],
        }}
      >
        {/* Hero */}
        <div
          style={{
            ...panelStyle,
            padding: `${space[4]}px ${space[5]}px`,
            display: "flex",
            flexDirection: "column",
            gap: space[3],
            animation: `psRowIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
            animationDelay: `${STAGGER_MS}ms`,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
            }}
          >
            <div
              style={{
                fontSize: font.size.xs,
                color: tokenColor.text2,
                fontWeight: font.weight.medium,
                textTransform: "uppercase",
                letterSpacing: font.letter.ultra,
              }}
            >
              {TASK_LABELS[task]} · {MODEL_LABEL[PRIMARY_MODEL]}
            </div>
            <div
              style={{
                fontFamily: font.mono,
                fontSize: font.size.xxs,
                color: tokenColor.text3,
              }}
            >
              {estimate.contextStrategy}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: space[4],
              alignItems: "baseline",
            }}
          >
            <HeroCell
              label="Input tokens"
              value={fmtTokens(Math.round(inputAnim))}
              accent={tokenColor.text0}
            />
            <HeroCell
              label="Output tokens"
              value={fmtTokens(Math.round(outputAnim))}
              accent={tokenColor.text0}
            />
            <HeroCell
              label="Cost (Sonnet 4.6)"
              value={fmtCost(costAnim)}
              accent={tokenColor.accent}
              primary
            />
          </div>
        </div>

        {/* Context strategy */}
        <div
          style={{
            ...panelStyle,
            animation: `psRowIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
            animationDelay: `${STAGGER_MS * 2}ms`,
          }}
        >
          <div style={panelLabelStyle}>Context strategy</div>
          <div
            style={{
              marginTop: space[2],
              fontSize: font.size.sm,
              color: tokenColor.text0,
              lineHeight: 1.5,
            }}
          >
            {estimate.contextStrategy}
          </div>
          <div
            style={{
              marginTop: space[3],
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
            }}
          >
            <div
              style={{
                fontSize: font.size.xxs,
                color: tokenColor.text2,
                textTransform: "uppercase",
                letterSpacing: font.letter.ultra,
              }}
            >
              Files needed
            </div>
            <div
              style={{
                fontFamily: font.mono,
                fontSize: 28,
                fontWeight: font.weight.bold,
                color: tokenColor.text0,
                fontVariantNumeric: "tabular-nums",
                letterSpacing: font.letter.tight,
                lineHeight: 1,
              }}
            >
              {estimate.filesNeeded}
            </div>
          </div>
        </div>
      </div>

      {/* Model cost table */}
      <div
        style={{
          ...panelStyle,
          padding: 0,
          overflow: "hidden",
          marginBottom: space[4],
          animation: `psRowIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
          animationDelay: `${STAGGER_MS * 3}ms`,
        }}
      >
        <div
          style={{
            padding: `${space[3]}px ${space[4]}px`,
            borderBottom: `1px solid ${tokenColor.border}`,
            fontSize: font.size.xs,
            color: tokenColor.text2,
            textTransform: "uppercase",
            letterSpacing: font.letter.ultra,
            fontWeight: font.weight.semibold,
          }}
        >
          모델 비용 비교 — {TASK_LABELS[task]}
        </div>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontFamily: font.mono,
          }}
        >
          <thead>
            <tr>
              {["Model", "Input $/1M", "Output $/1M", "Cost"].map((h, i) => (
                <th
                  key={h}
                  style={{
                    textAlign: i === 0 ? "left" : "right",
                    padding: `${space[2]}px ${space[4]}px`,
                    fontSize: font.size.xxs,
                    color: tokenColor.text2,
                    fontWeight: font.weight.medium,
                    textTransform: "uppercase",
                    letterSpacing: font.letter.ultra,
                    borderBottom: `1px solid ${tokenColor.border}`,
                    background: tokenColor.bg2,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {modelsInOrder.map((m, i) => {
              const price = AI_PRICING[m];
              const cost = estimate.costUsd[m];
              const isPrimary = m === PRIMARY_MODEL;
              return (
                <tr
                  key={m}
                  style={{
                    background: isPrimary ? tokenColor.accentSofter : "transparent",
                    animation: `psRowIn 420ms ${ENTRY_EASE} both`,
                    animationDelay: `${STAGGER_MS * 3 + i * 30}ms`,
                  }}
                >
                  <td
                    style={{
                      padding: `${space[2]}px ${space[4]}px`,
                      fontSize: font.size.sm,
                      color: tokenColor.text0,
                      fontWeight: isPrimary ? font.weight.semibold : font.weight.medium,
                      borderBottom: `1px solid ${tokenColor.border}`,
                      fontFamily: font.sans,
                    }}
                  >
                    {MODEL_LABEL[m]}
                    {isPrimary && (
                      <span
                        style={{
                          marginLeft: space[2],
                          padding: "1px 6px",
                          borderRadius: radiusToken.pill,
                          background: tokenColor.accentSoft,
                          color: tokenColor.accent,
                          fontSize: font.size.xxs,
                          fontWeight: font.weight.semibold,
                        }}
                      >
                        primary
                      </span>
                    )}
                  </td>
                  <td style={cellNumStyle}>${price.input.toFixed(2)}</td>
                  <td style={cellNumStyle}>${price.output.toFixed(2)}</td>
                  <td
                    style={{
                      ...cellNumStyle,
                      color: isPrimary ? tokenColor.accent : tokenColor.text0,
                      fontWeight: font.weight.bold,
                    }}
                  >
                    {fmtCost(cost)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Savings card */}
      <div
        style={{
          ...panelStyle,
          background: tokenColor.accentSofter,
          border: `1px solid ${tokenColor.accentBorder}`,
          marginBottom: space[4],
          animation: `psRowIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
          animationDelay: `${STAGGER_MS * 4}ms`,
        }}
      >
        <div style={panelLabelStyle}>Savings potential</div>
        <div
          style={{
            marginTop: space[2],
            fontSize: font.size.md,
            color: tokenColor.text0,
            lineHeight: 1.5,
          }}
        >
          <span style={{ fontWeight: font.weight.semibold, color: tokenColor.accent }}>
            Interface-only context
          </span>
          {" "}— {fmtTokens(savedTokens)} tok ({savedPct.toFixed(0)}%) 절감 · 예상 비용{" "}
          <span style={{ fontWeight: font.weight.bold, color: tokenColor.accent, fontFamily: font.mono }}>
            {fmtCost(minCost)}
          </span>
        </div>
        <div
          style={{
            marginTop: space[2],
            fontSize: font.size.xxs,
            color: tokenColor.text3,
            fontFamily: font.mono,
          }}
        >
          full: {fmtTokens(estimate.inputTokens)} tok → min: {fmtTokens(minimumViable)} tok (signatures + exports only)
        </div>
      </div>

      {/* Bottom: task comparison bars */}
      <div
        style={{
          ...panelStyle,
          animation: `psRowIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
          animationDelay: `${STAGGER_MS * 5}ms`,
        }}
      >
        <div style={panelLabelStyle}>Task comparison — same file, all tasks</div>
        <div
          style={{
            marginTop: space[3],
            display: "flex",
            flexDirection: "column",
            gap: space[2],
          }}
        >
          {AI_TASK_KINDS.map((t, i) => {
            const est = allTaskEstimates[t];
            const active = t === task;
            const inPct = maxInput > 0 ? (est.inputTokens / maxInput) * 100 : 0;
            const outPct = maxOutput > 0 ? (est.outputTokens / maxOutput) * 100 : 0;
            const cost = est.costUsd[PRIMARY_MODEL];
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTask(t)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "110px 1fr 90px",
                  alignItems: "center",
                  gap: space[3],
                  padding: `${space[2]}px ${space[3]}px`,
                  background: active ? tokenColor.accentSofter : "transparent",
                  border: `1px solid ${active ? tokenColor.accentBorder : tokenColor.border}`,
                  borderRadius: radiusToken.md,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  textAlign: "left",
                  transition: "background 160ms ease-out, border-color 160ms ease-out",
                }}
              >
                <span
                  style={{
                    fontSize: font.size.sm,
                    color: active ? tokenColor.accent : tokenColor.text0,
                    fontWeight: active ? font.weight.semibold : font.weight.medium,
                  }}
                >
                  {TASK_LABELS[t]}
                </span>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}
                >
                  <BarRow
                    label="in"
                    pct={inPct}
                    valueText={fmtTokens(est.inputTokens)}
                    color={tokenColor.accent}
                    delay={STAGGER_MS * 5 + i * 30}
                  />
                  <BarRow
                    label="out"
                    pct={outPct}
                    valueText={fmtTokens(est.outputTokens)}
                    color={tokenColor.success}
                    delay={STAGGER_MS * 5 + i * 30 + 40}
                  />
                </div>
                <span
                  style={{
                    fontFamily: font.mono,
                    fontSize: font.size.md,
                    color: active ? tokenColor.accent : tokenColor.text1,
                    fontWeight: font.weight.bold,
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {fmtCost(cost)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Subcomponents ─────────────────────────────────────────────────────

function HeroCell({
  label,
  value,
  accent,
  primary,
}: {
  label: string;
  value: string;
  accent: string;
  primary?: boolean;
}): ReactElement {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: space[1] }}>
      <div
        style={{
          fontSize: font.size.xxs,
          color: tokenColor.text2,
          textTransform: "uppercase",
          letterSpacing: font.letter.ultra,
          fontWeight: font.weight.medium,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: font.mono,
          fontSize: primary ? 48 : 36,
          lineHeight: 1,
          fontWeight: font.weight.bold,
          color: accent,
          letterSpacing: font.letter.tight,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function BarRow({
  label,
  pct,
  valueText,
  color,
  delay,
}: {
  label: string;
  pct: number;
  valueText: string;
  color: string;
  delay: number;
}): ReactElement {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "24px 1fr 56px",
        alignItems: "center",
        gap: space[2],
      }}
    >
      <span
        style={{
          fontFamily: font.mono,
          fontSize: font.size.xxs,
          color: tokenColor.text3,
        }}
      >
        {label}
      </span>
      <span
        style={{
          display: "block",
          height: 6,
          background: tokenColor.bg3,
          borderRadius: radiusToken.pill,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <span
          style={{
            display: "block",
            height: "100%",
            width: `${Math.max(2, Math.min(100, pct))}%`,
            background: color,
            borderRadius: radiusToken.pill,
            opacity: 0.85,
            transformOrigin: "0 50%",
            animation: `psBarGrow 520ms ${ENTRY_EASE} both`,
            animationDelay: `${delay}ms`,
          }}
        />
      </span>
      <span
        style={{
          fontFamily: font.mono,
          fontSize: font.size.xxs,
          color: tokenColor.text2,
          textAlign: "right",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {valueText}
      </span>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────

const panelStyle: CSSProperties = {
  background: tokenColor.bg1,
  border: `1px solid ${tokenColor.border}`,
  borderRadius: radiusToken.lg,
  padding: `${space[3]}px ${space[4]}px`,
  boxSizing: "border-box",
};

const panelLabelStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: tokenColor.text2,
  textTransform: "uppercase",
  letterSpacing: font.letter.ultra,
  fontWeight: font.weight.semibold,
};

const cellNumStyle: CSSProperties = {
  padding: `${space[2]}px ${space[4]}px`,
  fontSize: font.size.sm,
  color: tokenColor.text1,
  borderBottom: `1px solid ${tokenColor.border}`,
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
};

export const PromptSimulatorView = memo(PromptSimulatorViewImpl);
