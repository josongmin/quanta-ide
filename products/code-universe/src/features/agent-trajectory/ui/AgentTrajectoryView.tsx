// AgentTrajectoryView — Langsmith / Traceloop style agent-trace viewer.
// --------------------------------------------------------------------
// Reference: Langsmith · Traceloop · Braintrust 2024-2025; OpenTelemetry
// AI semantic conventions (gen_ai.* attributes) 2025. For a selected
// file + selected task, render the agent's step sequence as a vertical
// timeline. Failed steps followed by retry are rendered with a red
// connector. Click a step to inspect its payload (tokens, duration,
// thought snippet, tool name, target file link).

import { memo, useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactElement } from "react";

import type { Entity } from "@quanta/canvas-engine";
import {
  color,
  font,
  radius,
  space,
} from "../../../shared/ui/tokens";
import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import {
  AI_TASK_KINDS,
  agentTrajectory,
  computeCost,
  type AgentStep,
  type AgentStepKind,
  type AITaskKind,
} from "../../../shared/analytics/synth-metrics";

export interface AgentTrajectoryViewProps {
  ctx: ViewContextValue;
  entity?: Entity;
  empty?: boolean;
}

const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.28, 1)";
const ENTRY_MS = 520;
const STAGGER_MS = 18;
const COUNTER_MS = 640;

const KEYFRAMES = `
@keyframes atFadeIn {
  from { opacity: 0; transform: scale(0.98); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes atStepIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes atBarGrow {
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
}
`;

const TASK_KOREAN: Record<AITaskKind, string> = {
  explain: "설명",
  "fix-bug": "버그 수정",
  "add-feature": "기능 추가",
  refactor: "리팩터",
  test: "테스트 작성",
  review: "코드 리뷰",
};

const KIND_GLYPH: Record<AgentStepKind, string> = {
  read: "⊟",
  think: "◈",
  tool: "⚒",
  edit: "✎",
  test: "⊡",
  retry: "↻",
  done: "✓",
};

const KIND_LABEL: Record<AgentStepKind, string> = {
  read: "Read",
  think: "Think",
  tool: "Tool",
  edit: "Edit",
  test: "Test",
  retry: "Retry",
  done: "Done",
};

function kindColor(kind: AgentStepKind): string {
  switch (kind) {
    case "read": return color.text1;
    case "think": return color.accent;
    case "tool": return color.kindFloor;
    case "edit": return color.kindStreet;
    case "test": return color.kindGalaxy;
    case "retry": return color.danger;
    case "done": return color.success;
  }
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

function fmtDuration(ms: number): string {
  if (ms >= 60_000) return `${(ms / 60_000).toFixed(1)}m`;
  if (ms >= 1_000) return `${(ms / 1_000).toFixed(1)}s`;
  return `${ms}ms`;
}

function fmtCost(usd: number): string {
  if (usd < 0.001) return "<$0.001";
  if (usd < 0.01) return `$${usd.toFixed(3)}`;
  if (usd >= 100) return `$${usd.toFixed(0)}`;
  return `$${usd.toFixed(2)}`;
}

/** rAF interpolated counter 0→target, ease-out cubic. */
function useCounter(target: number, durationMs: number): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number): void => {
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

function AgentTrajectoryViewImpl({
  ctx,
  entity,
  empty,
}: AgentTrajectoryViewProps): ReactElement {
  const [task, setTask] = useState<AITaskKind>("fix-bug");
  const [selectedIdx, setSelectedIdx] = useState(0);

  const width = Math.max(1, ctx.viewportSize.w);
  const height = Math.max(1, ctx.viewportSize.h);

  const steps = useMemo<AgentStep[] | null>(() => {
    if (!entity) return null;
    return agentTrajectory(entity, task);
  }, [entity, task]);

  // Reset selected step when task changes.
  useEffect(() => {
    setSelectedIdx(0);
  }, [task, entity?.id]);

  const summary = useMemo(() => {
    if (!steps) return null;
    let duration = 0;
    let tokensIn = 0;
    let tokensOut = 0;
    for (const s of steps) {
      duration += s.durationMs;
      tokensIn += s.tokensIn;
      tokensOut += s.tokensOut;
    }
    const cost = computeCost(tokensIn, tokensOut)["claude-sonnet-4-6"];
    return {
      steps: steps.length,
      durationMs: duration,
      tokensIn,
      tokensOut,
      cost,
    };
  }, [steps]);

  // Max tokens per step for mini-bar normalisation.
  const maxStepTokens = useMemo(() => {
    if (!steps) return 1;
    let m = 1;
    for (const s of steps) {
      const t = s.tokensIn + s.tokensOut;
      if (t > m) m = t;
    }
    return m;
  }, [steps]);

  const stepCountAnim = useCounter(summary?.steps ?? 0, COUNTER_MS);
  const durationAnim = useCounter(summary?.durationMs ?? 0, COUNTER_MS);
  const tokensAnim = useCounter(
    (summary?.tokensIn ?? 0) + (summary?.tokensOut ?? 0),
    COUNTER_MS,
  );
  const costAnim = useCounter(summary?.cost ?? 0, COUNTER_MS);

  if (empty || !entity || !steps || !summary) {
    return (
      <div
        style={{
          width,
          height,
          background: color.bg0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: space[2],
          fontFamily: font.sans,
        }}
      >
        <style>{KEYFRAMES}</style>
        <div style={{ fontSize: font.size.md, color: color.text2 }}>
          파일을 선택하세요.
        </div>
        <div style={{ fontSize: font.size.xs, color: color.text3 }}>
          선택된 파일에 대해 agent 실행 trace 를 재구성합니다.
        </div>
      </div>
    );
  }

  const selected = steps[selectedIdx] ?? steps[0]!;
  const targetEntity = selected.targetFileId && ctx.tree
    ? ctx.tree.byId.get(selected.targetFileId)
    : null;

  return (
    <div
      style={{
        width,
        height,
        background: color.bg0,
        fontFamily: font.sans,
        color: color.text0,
        overflowY: "auto",
        boxSizing: "border-box",
        padding: `${space[5]}px ${space[6]}px`,
        animation: `atFadeIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
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
          Agent Trajectory
        </div>
        <div
          style={{
            fontSize: font.size.xs,
            color: color.text2,
            marginTop: 2,
          }}
        >
          에이전트 실행 트레이스 — Langsmith · Traceloop · Braintrust 2024-2025 · OpenTelemetry gen_ai
        </div>
      </div>

      {/* Task chip row */}
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
                  borderRadius: radius.pill,
                  border: `1px solid ${active ? color.accentBorder : color.border}`,
                  background: active ? color.accentSoft : color.bg1,
                  color: active ? color.accent : color.text1,
                  fontSize: font.size.sm,
                  fontWeight: active ? font.weight.semibold : font.weight.medium,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition:
                    "background 160ms ease-out, color 160ms ease-out, border-color 160ms ease-out",
                }}
              >
                {TASK_KOREAN[t]}
              </button>
            );
          })}
        </div>
        <div
          style={{
            marginTop: space[2],
            fontSize: font.size.xxs,
            color: color.text3,
            fontFamily: font.mono,
          }}
        >
          target: {entity.name}
        </div>
      </div>

      {/* Hero summary */}
      <div
        style={{
          ...panelStyle,
          marginTop: space[3],
          padding: `${space[4]}px ${space[5]}px`,
          animation: `atStepIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
          animationDelay: `${STAGGER_MS}ms`,
        }}
      >
        <div
          style={{
            fontSize: font.size.xxs,
            color: color.text2,
            textTransform: "uppercase",
            letterSpacing: font.letter.ultra,
            fontWeight: font.weight.medium,
          }}
        >
          Run summary · {TASK_KOREAN[task]}
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr 1fr",
            gap: space[4],
            marginTop: space[3],
            alignItems: "baseline",
          }}
        >
          <HeroCell label="Total steps" value={`${Math.round(stepCountAnim)}`} />
          <HeroCell label="Total duration" value={fmtDuration(Math.round(durationAnim))} />
          <HeroCell label="Total tokens" value={fmtTokens(Math.round(tokensAnim))} />
          <HeroCell
            label="Cost (Sonnet 4.6)"
            value={fmtCost(costAnim)}
            accent={color.accent}
          />
        </div>
      </div>

      {/* Main: step timeline + detail */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 340px",
          gap: space[3],
          marginTop: space[3],
        }}
      >
        {/* Timeline */}
        <div style={panelStyle}>
          <div style={panelLabelStyle}>Step timeline</div>
          <div
            style={{
              marginTop: space[3],
              display: "flex",
              flexDirection: "column",
              gap: 0,
            }}
          >
            {steps.map((s, i) => {
              const prev = i > 0 ? steps[i - 1]! : null;
              const connectorBad = prev && !prev.success;
              const active = i === selectedIdx;
              const tokenTotal = s.tokensIn + s.tokensOut;
              const pct = maxStepTokens > 0 ? (tokenTotal / maxStepTokens) * 100 : 0;
              const kc = kindColor(s.kind);
              return (
                <div key={s.id}>
                  {/* Connector line (not on first step) */}
                  {i > 0 && (
                    <div
                      style={{
                        marginLeft: 13,
                        width: 2,
                        height: 10,
                        background: connectorBad ? color.danger : color.border,
                        opacity: connectorBad ? 0.9 : 0.8,
                      }}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedIdx(i)}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "28px 1fr 88px 56px 12px",
                      alignItems: "center",
                      gap: space[2],
                      padding: `${space[2]}px ${space[3]}px`,
                      background: active ? color.accentSofter : "transparent",
                      border: `1px solid ${active ? color.accentBorder : color.border}`,
                      borderRadius: radius.md,
                      cursor: "pointer",
                      textAlign: "left",
                      fontFamily: "inherit",
                      width: "100%",
                      boxSizing: "border-box",
                      animation: `atStepIn 420ms ${ENTRY_EASE} both`,
                      animationDelay: `${STAGGER_MS * 2 + i * 14}ms`,
                      transition: "background 160ms ease-out, border-color 160ms ease-out",
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: radius.sm,
                        background: color.bg2,
                        border: `1px solid ${kc}40`,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: kc,
                        fontSize: 14,
                        fontWeight: font.weight.bold,
                      }}
                    >
                      {KIND_GLYPH[s.kind]}
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <span
                        style={{
                          display: "block",
                          fontSize: font.size.sm,
                          color: active ? color.accent : color.text0,
                          fontWeight: active
                            ? font.weight.semibold
                            : font.weight.medium,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        <span
                          style={{
                            display: "inline-block",
                            minWidth: 38,
                            fontSize: font.size.xxs,
                            color: kc,
                            textTransform: "uppercase",
                            letterSpacing: font.letter.ultra,
                            fontWeight: font.weight.semibold,
                            marginRight: space[2],
                          }}
                        >
                          {KIND_LABEL[s.kind]}
                        </span>
                        {s.label}
                      </span>
                      {/* Token bar */}
                      <span
                        style={{
                          display: "block",
                          marginTop: 4,
                          height: 3,
                          background: color.bg3,
                          borderRadius: radius.pill,
                          overflow: "hidden",
                          position: "relative",
                        }}
                      >
                        <span
                          style={{
                            display: "block",
                            height: "100%",
                            width: `${Math.max(2, Math.min(100, pct))}%`,
                            background: kc,
                            opacity: 0.75,
                            transformOrigin: "0 50%",
                            animation: `atBarGrow 520ms ${ENTRY_EASE} both`,
                            animationDelay: `${STAGGER_MS * 2 + i * 14 + 60}ms`,
                          }}
                        />
                      </span>
                    </span>
                    <span
                      style={{
                        fontFamily: font.mono,
                        fontSize: font.size.xxs,
                        color: color.text2,
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {fmtDuration(s.durationMs)}
                    </span>
                    <span
                      style={{
                        fontFamily: font.mono,
                        fontSize: font.size.xxs,
                        color: color.text3,
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {fmtTokens(tokenTotal)}
                    </span>
                    <span
                      aria-hidden
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: s.success ? color.success : color.danger,
                      }}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Detail pane */}
        <div
          style={{
            ...panelStyle,
            animation: `atStepIn ${ENTRY_MS}ms ${ENTRY_EASE} both`,
            animationDelay: `${STAGGER_MS * 2}ms`,
            alignSelf: "start",
          }}
        >
          <div style={panelLabelStyle}>Step detail</div>
          <div style={{ marginTop: space[3] }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: space[2],
                marginBottom: space[2],
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: radius.sm,
                  background: color.bg2,
                  border: `1px solid ${kindColor(selected.kind)}40`,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: kindColor(selected.kind),
                  fontSize: 16,
                  fontWeight: font.weight.bold,
                }}
              >
                {KIND_GLYPH[selected.kind]}
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    fontSize: font.size.xxs,
                    color: kindColor(selected.kind),
                    textTransform: "uppercase",
                    letterSpacing: font.letter.ultra,
                    fontWeight: font.weight.semibold,
                  }}
                >
                  {KIND_LABEL[selected.kind]} · step {selected.idx + 1}/{steps.length}
                </div>
                <div
                  style={{
                    fontSize: font.size.sm,
                    color: color.text0,
                    fontWeight: font.weight.medium,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {selected.label}
                </div>
              </div>
            </div>

            <DetailRow label="Duration" value={fmtDuration(selected.durationMs)} />
            <DetailRow label="Tokens in" value={fmtTokens(selected.tokensIn)} />
            <DetailRow label="Tokens out" value={fmtTokens(selected.tokensOut)} />
            {selected.toolName !== undefined && (
              <DetailRow label="Tool" value={selected.toolName} mono />
            )}
            <DetailRow
              label="Status"
              value={selected.success ? "success" : "failed"}
              tint={selected.success ? color.success : color.danger}
            />
            {targetEntity && (
              <div style={detailRow}>
                <span style={detailKey}>Target</span>
                <button
                  type="button"
                  onClick={() => ctx.dispatch.selectEntity(targetEntity.id)}
                  style={{
                    background: "transparent",
                    border: "none",
                    padding: 0,
                    color: color.accent,
                    fontFamily: font.mono,
                    fontSize: font.size.xxs,
                    cursor: "pointer",
                    textAlign: "right",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: 180,
                  }}
                  title={targetEntity.path}
                >
                  {targetEntity.name}
                </button>
              </div>
            )}

            {selected.kind === "think" && selected.thoughtSnippet && (
              <div
                style={{
                  marginTop: space[3],
                  padding: `${space[2]}px ${space[3]}px`,
                  background: color.accentSofter,
                  border: `1px solid ${color.accentBorder}`,
                  borderRadius: radius.sm,
                  fontSize: font.size.xs,
                  color: color.text0,
                  lineHeight: 1.5,
                  fontStyle: "italic",
                }}
              >
                “{selected.thoughtSnippet}”
              </div>
            )}
          </div>
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
}: {
  label: string;
  value: string;
  accent?: string;
}): ReactElement {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: space[1] }}>
      <div
        style={{
          fontSize: font.size.xxs,
          color: color.text2,
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
          fontSize: 30,
          lineHeight: 1,
          fontWeight: font.weight.bold,
          color: accent ?? color.text0,
          letterSpacing: font.letter.tight,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono,
  tint,
}: {
  label: string;
  value: string;
  mono?: boolean;
  tint?: string;
}): ReactElement {
  return (
    <div style={detailRow}>
      <span style={detailKey}>{label}</span>
      <span
        style={{
          fontFamily: mono ? font.mono : font.sans,
          fontSize: font.size.xs,
          color: tint ?? color.text0,
          fontVariantNumeric: "tabular-nums",
          textAlign: "right",
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────

const panelStyle: CSSProperties = {
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.lg,
  padding: `${space[3]}px ${space[4]}px`,
  boxSizing: "border-box",
};

const panelLabelStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  textTransform: "uppercase",
  letterSpacing: font.letter.ultra,
  fontWeight: font.weight.semibold,
};

const detailRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: `${space[1]}px 0`,
  borderBottom: `1px solid ${color.border}`,
};

const detailKey: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  textTransform: "uppercase",
  letterSpacing: font.letter.ultra,
};

export const AgentTrajectoryView = memo(AgentTrajectoryViewImpl);
