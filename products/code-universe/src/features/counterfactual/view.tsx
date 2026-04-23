// Counterfactual view descriptor — "what if" prompt variants.
// --------------------------------------------------------------------
// For a selected file, auto-generate 3-5 counterfactual scenarios
// ("if I asked X instead of Y — what would the agent do?") to surface
// the decision boundary of the agent's recent actions. Each scenario
// carries a predicted outcome paragraph and a confidence delta chip
// so the reader can see which framings the agent is most sensitive to.
//
// Reference: Miller "Explanation in Artificial Intelligence: Insights
// from the Social Sciences", AI Journal 2019. Wachter, Mittelstadt,
// Russell "Counterfactual Explanations Without Opening the Black Box"
// 2018. LLM counterfactual reasoning literature 2024.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { CounterfactualView } from "./ui/CounterfactualView";

function CounterfactualModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  const entity = ctx.selectedId ? ctx.tree.byId.get(ctx.selectedId) : null;
  if (!entity || (entity.kind !== "building" && entity.kind !== "floor")) {
    return <CounterfactualView empty />;
  }
  return <CounterfactualView entity={entity} />;
}

export const counterfactualViewDescriptor: ViewDescriptor = {
  id: "counterfactual",
  label: "What-If",
  glyph: "⎆",
  hint: "대조 가정 — 'if X instead of Y'",
  tech: "counterfactual prompt × 예측 결과 × confidence delta",
  usecase: "에이전트 결정의 민감도 파악. '왜 이 선택했는지' 역추론.",
  category: "ai",
  contexts: ["file"],
  needs: { tree: true, selection: true },
  order: 1140,
  capabilityKinds: ["view", "decision-input", "workflow-step"],
  taxonomy: {
    primary: {
      domain: "ai-agent",
      scope: "task",
      intent: "explain",
    },
    scopes: ["file", "task"],
    intents: ["explain", "decide", "diagnose"],
    subdomain: "counterfactual-reasoning",
    personas: ["developer", "tech-lead"],
    surfaces: ["view", "tab"],
    maturity: "experimental",
    signal: {
      dataFreshness: "snapshot",
      confidence: "heuristic",
      actionability: "explain",
      cost: "medium",
      latency: "interactive",
      determinism: "heuristic",
      evidenceLevel: "weak",
      decisionGrade: "triage",
    },
    related: ["attention-map", "uncertainty-map", "anticipate"],
    keywords: ["counterfactual", "what-if", "sensitivity", "prompt"],
  },
  decision: {
    grade: "triage",
    supports: ["delegate", "approve-agent-run"],
    evidenceClass: "weak",
    failClosedEligible: false,
    humanReviewRequired: true,
  },
  actions: ["open-tab", "compare-related", "attach-to-agent-plan"],
  workflow: {
    usableInStacks: ["agent-failure-stack"],
    canBeAutoSuggested: true,
    canBeAutoAttached: false,
    requiresOrderedExecution: false,
  },
  quality: {
    maturity: "experimental",
    owner: "research",
  },
  Component: CounterfactualModeView,
};
