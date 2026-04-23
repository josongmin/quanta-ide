// ThinkingBudget view descriptor — reasoning-model thinking-token usage.
// --------------------------------------------------------------------
// For a selected file, fabricate the 6-task AI_TASK_KINDS table with
// thinking vs output token split. Highlights plateau tasks where extra
// reasoning no longer improves accuracy — the signal that the user
// should switch from "deep" to "shallow" mode and save tokens.
//
// Reference: OpenAI o1 technical report 2024. Anthropic Extended
// Thinking (Claude 3.7 / Sonnet 4) 2025. Snell et al. "Scaling LLM
// Test-Time Compute Optimally — Thinking beats Scaling" 2024.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { ThinkingBudgetView } from "./ui/ThinkingBudgetView";

function ThinkingBudgetModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  const entity = ctx.selectedId ? ctx.tree.byId.get(ctx.selectedId) : null;
  if (!entity || (entity.kind !== "building" && entity.kind !== "floor")) {
    return <ThinkingBudgetView empty />;
  }
  return <ThinkingBudgetView entity={entity} />;
}

export const thinkingBudgetViewDescriptor: ViewDescriptor = {
  id: "thinking-budget",
  label: "Thinking",
  glyph: "◐",
  hint: "추론 토큰 예산 — o1 / Claude Extended",
  tech: "thinking vs output 토큰 분해 × plateau 감지",
  usecase: "reasoning 모델 사용 시 thinking budget 최적화. plateau 넘으면 낭비.",
  category: "ai",
  contexts: ["file"],
  needs: { tree: true, selection: true },
  order: 1120,
  capabilityKinds: ["view", "decision-input"],
  taxonomy: {
    primary: {
      domain: "ai-context-model",
      scope: "budget",
      intent: "explain",
    },
    scopes: ["file", "task", "model", "budget"],
    intents: ["optimize", "decide", "explain"],
    subdomain: "reasoning-compute",
    personas: ["developer", "ai-operator"],
    surfaces: ["view", "tab"],
    maturity: "advanced",
    signal: {
      dataFreshness: "snapshot",
      confidence: "estimated",
      actionability: "direct-action",
      cost: "medium",
      latency: "interactive",
      determinism: "bounded",
      evidenceLevel: "strong",
      decisionGrade: "advisory",
    },
    related: ["prompt-simulator", "model-router", "context-shape"],
    keywords: ["thinking", "budget", "reasoning", "plateau", "tokens"],
  },
  decision: {
    grade: "advisory",
    supports: ["route-model", "delegate"],
    evidenceClass: "strong",
    failClosedEligible: false,
    humanReviewRequired: false,
  },
  actions: ["open-tab", "run-analysis", "attach-to-task-routing"],
  workflow: {
    usableInStacks: ["context-engineering-stack"],
    canBeAutoSuggested: true,
    canBeAutoAttached: true,
    requiresOrderedExecution: false,
  },
  quality: {
    maturity: "advanced",
    owner: "ai-platform",
  },
  Component: ThinkingBudgetModeView,
};
