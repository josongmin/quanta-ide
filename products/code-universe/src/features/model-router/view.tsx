// ModelRouter view descriptor — per-task model routing recommendations.
// --------------------------------------------------------------------
// Reference: Chen et al. "RouteLLM: Learning to Route LLMs with
// Preference Data" 2024; Ding et al. "FrugalGPT: How to Use Large
// Language Models While Reducing Cost and Improving Performance" 2023.
// Routes each task (explain/fix-bug/add-feature/refactor/test/review)
// to the cheapest model that meets an accuracy threshold — "don't pay
// Opus prices for an explain task a Mini can handle".

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { ModelRouterView } from "./ui/ModelRouterView";

function ModelRouterModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  const entity = ctx.selectedId ? ctx.tree.byId.get(ctx.selectedId) : null;
  if (!entity || (entity.kind !== "building" && entity.kind !== "floor")) {
    return <ModelRouterView ctx={ctx} empty />;
  }
  return <ModelRouterView ctx={ctx} entity={entity} />;
}

export const modelRouterViewDescriptor: ViewDescriptor = {
  id: "model-router",
  label: "Router",
  glyph: "⟷",
  hint: "모델 라우팅 — task × 정확도 × 비용 최적화",
  tech: "FrugalGPT × RouteLLM 스타일 per-task model selection",
  usecase: "Sonnet으로 다 때리지 말고 싼 모델로 넘길 수 있는 태스크 식별.",
  category: "ai",
  contexts: ["file"],
  needs: { tree: true, selection: true },
  order: 800,
  capabilityKinds: ["view", "decision-input", "workflow-step"],
  taxonomy: {
    primary: {
      domain: "ai-context-model",
      scope: "task",
      intent: "decide",
    },
    scopes: ["file", "task", "model", "budget"],
    intents: ["decide", "optimize"],
    subdomain: "model-routing",
    personas: ["developer", "ai-operator", "manager"],
    surfaces: ["view", "tab", "command"],
    maturity: "core",
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
    related: ["prompt-simulator", "model-swap-sim", "token-economy"],
    keywords: ["model", "router", "frugal", "cost", "accuracy"],
  },
  decision: {
    grade: "advisory",
    supports: ["route-model", "delegate"],
    evidenceClass: "strong",
    failClosedEligible: false,
    humanReviewRequired: false,
  },
  actions: ["open-tab", "run-analysis", "attach-to-task-routing", "attach-to-agent-plan"],
  workflow: {
    usableInStacks: ["context-engineering-stack", "agent-delegation-stack"],
    canBeAutoSuggested: true,
    canBeAutoAttached: true,
    requiresOrderedExecution: false,
  },
  quality: {
    maturity: "core",
    owner: "ai-platform",
  },
  Component: ModelRouterModeView,
};
