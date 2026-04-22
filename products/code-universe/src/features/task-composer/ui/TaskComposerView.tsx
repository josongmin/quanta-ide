// TaskComposerView — natural-language task-entry wizard for agents.
// --------------------------------------------------------------------
// Layout (2 columns):
//   Left 62%:
//     • Large textarea — "태스크 설명을 자연어로 입력…"
//     • Auto-detected task-kind chip (inferred from keywords inline).
//     • Estimated cost preview (Claude Sonnet 4.6 @ inferred kind).
//     • Top-5 semantically relevant files based on query tokens
//       (token-AND match over file names, similar to where-to scoring).
//     • Horizontal "Templates" strip — click to autofill textarea + kind.
//   Right 38%:
//     • Model routing panel — cheapest viable model for this task.
//     • Predicted success probability — agentSuccessProbability on the
//       first suggested file.
//     • "Create task" stub button at the bottom.
//
// Reference: Motion task-entry UX; Linear "Magic NL" pattern;
// Anthropic Claude Projects.

import { memo, useEffect, useMemo, useState, type CSSProperties, type ReactElement } from "react";
import type { Entity } from "@quanta/canvas-engine";

import type { ViewContextValue } from "../../view-mode/model/view-descriptor";
import { color, font, radius, space, transition } from "../../../shared/ui/tokens";
import {
  AI_PRICING,
  agentSuccessProbability,
  estimateTaskCost,
  synthTaskTemplates,
  type AIModel,
  type AITaskKind,
  type TaskTemplate,
} from "../../../shared/analytics/synth-metrics";

interface Props {
  ctx: ViewContextValue;
}

const TASK_KOREAN: Record<AITaskKind, string> = {
  explain: "설명", "fix-bug": "버그 수정", "add-feature": "기능 추가",
  refactor: "리팩터", test: "테스트 작성", review: "코드 리뷰",
};

const MODEL_LABEL: Record<AIModel, string> = {
  "claude-sonnet-4-6": "Claude Sonnet 4.6",
  "claude-opus-4-7":   "Claude Opus 4.7",
  "gpt-5":             "GPT-5",
  "gpt-5-mini":        "GPT-5 mini",
  "gemini-2.5-pro":    "Gemini 2.5 Pro",
};

const KEYFRAMES = `
@keyframes tc-enter { 0% { opacity: 0; transform: scale(0.98); } 100% { opacity: 1; transform: scale(1); } }
@keyframes tc-item { 0% { opacity: 0; transform: translateY(6px); } 100% { opacity: 1; transform: translateY(0); } }
`;

const DEBOUNCE_MS = 160;

function inferTaskKind(q: string): AITaskKind {
  const t = q.toLowerCase();
  if (/\b(fix|bug|error|broken|crash|regress|leak|patch)\b/.test(t)) return "fix-bug";
  if (/\b(test|spec|coverage|cover|edge.?case)\b/.test(t)) return "test";
  if (/\b(refactor|rename|extract|inline|simplif|cleanup|reorg)\b/.test(t)) return "refactor";
  if (/\b(add|new|feature|endpoint|create|support)\b/.test(t)) return "add-feature";
  if (/\b(review|audit|inspect|check)\b/.test(t)) return "review";
  if (/\b(explain|doc|document|what|why|how|describe)\b/.test(t)) return "explain";
  return "fix-bug";
}

function fmtCost(usd: number): string {
  if (usd < 0.01) return "<$0.01";
  if (usd >= 100) return `$${usd.toFixed(0)}`;
  return `$${usd.toFixed(2)}`;
}

function tokenize(q: string): string[] {
  return q.toLowerCase()
    .split(/[\s,._/\-]+/)
    .map(t => t.trim())
    .filter(t => t.length > 1);
}

/** Top-5 files by token-AND match over file name (similar to where-to). */
function suggestFiles(ctx: ViewContextValue, query: string): Entity[] {
  if (!ctx.tree) return [];
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];
  const scored: Array<{ e: Entity; score: number }> = [];
  for (const e of ctx.tree.byId.values()) {
    if (e.kind !== "building") continue;
    const name = e.name.toLowerCase();
    let hits = 0;
    for (const t of tokens) if (name.includes(t)) hits++;
    if (hits === 0) continue;
    // Bonus for more hits and short file names.
    const score = hits * 3 + Math.max(0, 30 - name.length) / 30;
    scored.push({ e, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 5).map(s => s.e);
}

function cheapestViableModel(task: AITaskKind, inputTokens: number, outputTokens: number): { model: AIModel; costUsd: number; rationale: string } {
  // Model capability gates — Opus/Sonnet for harder tasks; mini/flash for easy.
  const easyTasks: AITaskKind[] = ["explain", "review"];
  const candidates: AIModel[] = easyTasks.includes(task)
    ? ["gpt-5-mini", "gemini-2.5-pro", "gpt-5", "claude-sonnet-4-6", "claude-opus-4-7"]
    : task === "refactor" || task === "add-feature"
    ? ["claude-sonnet-4-6", "gpt-5", "gemini-2.5-pro", "claude-opus-4-7"]
    : ["gemini-2.5-pro", "gpt-5", "claude-sonnet-4-6", "gpt-5-mini"];

  let best: { model: AIModel; cost: number } | null = null;
  for (const m of candidates) {
    const p = AI_PRICING[m];
    const c = (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output;
    if (!best || c < best.cost) best = { model: m, cost: c };
  }
  const pick = best!;
  const rationale = easyTasks.includes(task)
    ? "쉬운 태스크 — 저가 모델로 충분"
    : task === "refactor" || task === "add-feature"
    ? "복잡 태스크 — 강한 모델 필요"
    : "중간 난이도 — 비용/성능 균형";
  return { model: pick.model, costUsd: pick.cost, rationale };
}

function TaskComposerViewImpl({ ctx }: Props): ReactElement | null {
  const templates = useMemo(() => synthTaskTemplates(), []);
  const [text, setText] = useState("");
  const [debounced, setDebounced] = useState("");
  const [kindOverride, setKindOverride] = useState<AITaskKind | null>(null);

  useEffect(() => {
    const h = setTimeout(() => setDebounced(text), DEBOUNCE_MS);
    return () => clearTimeout(h);
  }, [text]);

  const inferredKind = useMemo<AITaskKind>(() => {
    if (kindOverride) return kindOverride;
    return inferTaskKind(debounced);
  }, [debounced, kindOverride]);

  const suggestions = useMemo(() => suggestFiles(ctx, debounced), [ctx, debounced]);

  const costEstimate = useMemo(() => {
    if (!ctx.tree || suggestions.length === 0) return null;
    return estimateTaskCost(suggestions[0]!, ctx.tree, ctx.graph?.fileEdges, inferredKind);
  }, [ctx.tree, ctx.graph, suggestions, inferredKind]);

  const routing = useMemo(() => {
    if (!costEstimate) return null;
    return cheapestViableModel(inferredKind, costEstimate.inputTokens, costEstimate.outputTokens);
  }, [costEstimate, inferredKind]);

  const successProb = useMemo(() => {
    if (suggestions.length === 0) return null;
    return agentSuccessProbability(suggestions[0]!, inferredKind);
  }, [suggestions, inferredKind]);

  const applyTemplate = (t: TaskTemplate) => {
    setText(t.promptOutline);
    setKindOverride(t.task);
  };

  return (
    <div style={rootStyle}>
      <style>{KEYFRAMES}</style>

      <header style={headerStyle}>
        <div>
          <div style={{ fontSize: font.size.lg, fontWeight: font.weight.semibold, color: color.text0 }}>Task Composer</div>
          <div style={{ marginTop: space[1], fontSize: font.size.xs, color: color.text2 }}>
            자연어 태스크 설명 → 자동 분류 × 파일 추천 × 비용 프리뷰
          </div>
        </div>
      </header>

      <div style={bodyStyle}>
        <div style={leftColumn}>
          <div style={panelStyle}>
            <div style={labelStyle}>태스크 설명</div>
            <textarea
              value={text}
              onChange={e => { setText(e.target.value); setKindOverride(null); }}
              placeholder="예: fix the NaN in layout packer when a file has zero lines"
              spellCheck={false}
              style={textareaStyle}
            />
            <div style={{ marginTop: space[3], display: "flex", alignItems: "center", gap: space[2], flexWrap: "wrap" }}>
              <span style={labelInline}>자동 분류</span>
              <span style={kindChipStyle(true)}>
                {TASK_KOREAN[inferredKind]}
              </span>
              <span style={{ flex: 1 }} />
              {costEstimate && (
                <span style={{ fontFamily: font.mono, fontSize: font.size.xs, color: color.text1 }}>
                  ~{fmtCost(costEstimate.costUsd["claude-sonnet-4-6"])} · {costEstimate.filesNeeded} files
                </span>
              )}
            </div>
          </div>

          <div style={{ ...panelStyle, animationDelay: "40ms" }}>
            <div style={labelStyle}>추천 파일 (top 5)</div>
            {suggestions.length === 0 ? (
              <div style={{ padding: `${space[3]}px 0`, color: color.text3, fontSize: font.size.xs }}>
                설명을 입력하면 관련 파일이 나타납니다.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", marginTop: space[2] }}>
                {suggestions.map((e, i) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => ctx.dispatch.selectEntity(e.id)}
                    style={{
                      ...suggestionRow,
                      animationDelay: `${i * 22}ms`,
                    }}
                  >
                    <span style={{
                      fontSize: font.size.xxs,
                      fontFamily: font.mono,
                      color: color.text3,
                      minWidth: 16,
                    }}>
                      {i + 1}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: font.size.sm, color: color.text0, display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {e.name}
                      </span>
                      <span style={{ fontSize: font.size.xxs, color: color.text3, fontFamily: font.mono, display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {e.path}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ ...panelStyle, animationDelay: "80ms" }}>
            <div style={labelStyle}>Templates</div>
            <div style={templateStrip}>
              {templates.map((t, i) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => applyTemplate(t)}
                  style={{
                    ...templateCard,
                    animationDelay: `${i * 22}ms`,
                  }}
                >
                  <span style={{
                    fontSize: font.size.xxs,
                    color: color.accent,
                    fontFamily: font.mono,
                    textTransform: "uppercase",
                    letterSpacing: font.letter.ultra,
                  }}>
                    {TASK_KOREAN[t.task]}
                  </span>
                  <span style={{
                    fontSize: font.size.sm,
                    fontWeight: font.weight.semibold,
                    color: color.text0,
                    marginTop: 2,
                  }}>
                    {t.name}
                  </span>
                  <span style={{ fontSize: font.size.xxs, color: color.text2, marginTop: 2, lineHeight: 1.35 }}>
                    {t.description}
                  </span>
                  <span style={{ fontFamily: font.mono, fontSize: font.size.xxs, color: color.text3, marginTop: space[2] }}>
                    ~{fmtCost(t.estimatedCostUsd)} · {Math.round(t.successRate * 100)}% 성공률
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={rightColumn}>
          <div style={panelStyle}>
            <div style={labelStyle}>모델 라우팅</div>
            {routing ? (
              <>
                <div style={{ marginTop: space[2], fontSize: font.size.md, fontWeight: font.weight.semibold, color: color.text0 }}>
                  {MODEL_LABEL[routing.model]}
                </div>
                <div style={{ marginTop: space[1], fontSize: font.size.xs, color: color.text2 }}>
                  {routing.rationale}
                </div>
                <div style={{
                  marginTop: space[3],
                  fontFamily: font.mono,
                  fontSize: 28,
                  fontWeight: font.weight.bold,
                  color: color.accent,
                  fontVariantNumeric: "tabular-nums",
                  lineHeight: 1,
                }}>
                  {fmtCost(routing.costUsd)}
                </div>
                <div style={{ marginTop: space[1], fontSize: font.size.xxs, color: color.text3, fontFamily: font.mono }}>
                  예상 1회 비용
                </div>
              </>
            ) : (
              <div style={{ marginTop: space[2], fontSize: font.size.xs, color: color.text3 }}>
                설명을 입력하면 추천 모델이 나타납니다.
              </div>
            )}
          </div>

          <div style={{ ...panelStyle, animationDelay: "40ms" }}>
            <div style={labelStyle}>성공 확률</div>
            {successProb != null ? (
              <>
                <div style={{
                  marginTop: space[2],
                  fontFamily: font.mono,
                  fontSize: 34,
                  fontWeight: font.weight.bold,
                  color: successProb > 0.7 ? color.success : successProb > 0.4 ? color.warn : color.danger,
                  fontVariantNumeric: "tabular-nums",
                  lineHeight: 1,
                }}>
                  {Math.round(successProb * 100)}%
                </div>
                <div style={{ marginTop: space[2], height: 6, background: color.bg3, borderRadius: radius.pill, overflow: "hidden" }}>
                  <div style={{
                    height: "100%",
                    width: `${successProb * 100}%`,
                    background: successProb > 0.7 ? color.success : successProb > 0.4 ? color.warn : color.danger,
                  }} />
                </div>
                <div style={{ marginTop: space[2], fontSize: font.size.xxs, color: color.text3 }}>
                  Jimenez et al. SWE-bench 2024 heuristic
                </div>
              </>
            ) : (
              <div style={{ marginTop: space[2], fontSize: font.size.xs, color: color.text3 }}>
                파일 추천 후 계산됩니다.
              </div>
            )}
          </div>

          <button
            type="button"
            style={createBtn}
            disabled={text.trim().length === 0}
          >
            Create task
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────

const rootStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  padding: `${space[6]}px ${space[7]}px`,
  background: color.bg0,
  boxSizing: "border-box",
  overflow: "auto",
  animation: "tc-enter 520ms cubic-bezier(0.22, 1, 0.28, 1) both",
  fontFamily: font.sans,
};

const headerStyle: CSSProperties = {
  marginBottom: space[4],
};

const bodyStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 320px",
  gap: space[3],
  alignItems: "start",
};

const leftColumn: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: space[3],
  minWidth: 0,
};

const rightColumn: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: space[3],
};

const panelStyle: CSSProperties = {
  padding: space[4],
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  animation: "tc-item 440ms cubic-bezier(0.22, 1, 0.28, 1) both",
};

const labelStyle: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  fontWeight: font.weight.semibold,
};

const labelInline: CSSProperties = {
  fontSize: font.size.xxs,
  color: color.text2,
  letterSpacing: font.letter.ultra,
  textTransform: "uppercase",
  fontWeight: font.weight.semibold,
};

const textareaStyle: CSSProperties = {
  width: "100%",
  minHeight: 110,
  marginTop: space[2],
  padding: space[3],
  background: color.bg2,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  fontFamily: font.sans,
  fontSize: font.size.md,
  color: color.text0,
  boxSizing: "border-box",
  resize: "vertical",
  outline: "none",
  lineHeight: 1.5,
};

const kindChipStyle = (_active: boolean): CSSProperties => ({
  padding: `${space[1]}px ${space[3]}px`,
  borderRadius: radius.pill,
  background: color.accentSoft,
  border: `1px solid ${color.accentBorder}`,
  color: color.accent,
  fontSize: font.size.xs,
  fontWeight: font.weight.semibold,
});

const suggestionRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: space[3],
  padding: `${space[2]}px ${space[3]}px`,
  borderTop: `1px solid ${color.border}`,
  background: "transparent",
  border: "none",
  borderBottom: "none",
  borderLeft: "none",
  borderRight: "none",
  cursor: "pointer",
  textAlign: "left",
  font: "inherit",
  transition: `background ${transition.base}`,
  animation: "tc-item 440ms cubic-bezier(0.22, 1, 0.28, 1) both",
};

const templateStrip: CSSProperties = {
  display: "flex",
  gap: space[3],
  marginTop: space[3],
  overflowX: "auto",
  paddingBottom: space[2],
};

const templateCard: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  minWidth: 200,
  padding: space[3],
  background: color.bg2,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  cursor: "pointer",
  textAlign: "left",
  font: "inherit",
  transition: `all ${transition.base}`,
  animation: "tc-item 440ms cubic-bezier(0.22, 1, 0.28, 1) both",
};

const createBtn: CSSProperties = {
  padding: `${space[3]}px ${space[4]}px`,
  borderRadius: radius.md,
  background: color.accent,
  color: "#ffffff",
  border: "none",
  fontFamily: font.sans,
  fontSize: font.size.sm,
  fontWeight: font.weight.semibold,
  cursor: "pointer",
  transition: `background ${transition.base}`,
};

export const TaskComposerView = memo(TaskComposerViewImpl);
