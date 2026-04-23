// ContextShape view descriptor — optimal prompt structure recommender.
// --------------------------------------------------------------------
// Reference:
//   - Anthropic "Effective Context Engineering" (2025)
//   - Liu et al. "Lost in the Middle" (2023) — positional attention bias
//   - Anthropic Prompt Caching (2024) — stable prefix reuse
//   - System-prompt design patterns (2024-2025)
//
// Gives a per-file recommended prompt layout: which section (system /
// memory / query / code-primary / tests / code-neighbor) in what order,
// token budget per section, and a position-bias tag (front / middle /
// end) so reviewers can see which parts should sit at the attention
// edges and which are allowed to live in the "lost middle".

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { ContextShapeView } from "./ui/ContextShapeView";

function ContextShapeModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  const entity = ctx.selectedId ? ctx.tree.byId.get(ctx.selectedId) : null;
  if (!entity || (entity.kind !== "building" && entity.kind !== "floor")) {
    return <ContextShapeView ctx={ctx} empty />;
  }
  return <ContextShapeView ctx={ctx} entity={entity} />;
}

export const contextShapeViewDescriptor: ViewDescriptor = {
  id: "context-shape",
  label: "Shape",
  glyph: "◫",
  hint: "컨텍스트 shape — 프롬프트 구조 최적화",
  tech: "순서 × 토큰 예산 × 위치 bias 인식",
  usecase: "Lost-in-Middle 회피 + prompt caching 최적화. 새 워크플로우 설계 시 가이드.",
  category: "ai",
  contexts: ["file"],
  needs: { tree: true, selection: true },
  order: 1150,
  capabilityKinds: ["view", "decision-input", "workflow-step"],
  taxonomy: {
    primary: {
      domain: "ai-context-model",
      scope: "model",
      intent: "optimize",
    },
    scopes: ["file", "task", "model", "budget"],
    intents: ["optimize", "decide", "explain"],
    subdomain: "prompt-structure",
    personas: ["developer", "ai-operator"],
    surfaces: ["view", "tab", "command"],
    maturity: "advanced",
    signal: {
      dataFreshness: "snapshot",
      confidence: "measured",
      actionability: "direct-action",
      cost: "medium",
      latency: "interactive",
      determinism: "deterministic",
      evidenceLevel: "strong",
      decisionGrade: "advisory",
    },
    related: ["context-curator", "context-window-fit", "thinking-budget"],
    keywords: ["context", "shape", "prompt", "order", "bias"],
  },
  decision: {
    grade: "advisory",
    supports: ["route-model", "delegate"],
    evidenceClass: "strong",
    failClosedEligible: false,
    humanReviewRequired: false,
  },
  actions: ["open-tab", "run-analysis", "attach-to-agent-plan", "attach-to-task-routing"],
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
  Component: ContextShapeModeView,
};
