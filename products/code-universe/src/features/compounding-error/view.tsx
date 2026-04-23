// CompoundingError view descriptor — agent chain-length × per-step accuracy.
// --------------------------------------------------------------------
// Reference: Jimenez et al. "SWE-bench" ICLR 2024; METR "Measuring AI
// Ability to Complete Long Tasks" (2024). "Compounding error" is a known
// 2026 agent limitation: end-to-end success decays as p^k where p is
// per-step accuracy and k is chain length. Visualising the decay curve
// plus observed per-task chain lengths makes the limit concrete for
// deployment decisions.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { CompoundingErrorView } from "./ui/CompoundingErrorView";

function CompoundingErrorModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return <CompoundingErrorView ctx={ctx} />;
}

export const compoundingErrorViewDescriptor: ViewDescriptor = {
  id: "compounding-error",
  label: "Compound",
  glyph: "∿",
  hint: "체인 길어질수록 무너짐 — per-step × chain length",
  tech: "p^k 합성 정확도 곡선 × 태스크별 관찰된 chain length",
  usecase: "왜 에이전트가 복잡한 태스크에서 망가지나. chain 줄이기 / per-step 높이기 결정.",
  category: "ai",
  contexts: ["repo"],
  needs: { tree: true },
  order: 1010,
  capabilityKinds: ["view", "decision-input", "workflow-step"],
  taxonomy: {
    primary: {
      domain: "ai-agent",
      scope: "repo",
      intent: "explain",
    },
    scopes: ["repo", "task", "agent-run"],
    intents: ["diagnose", "decide", "explain"],
    subdomain: "chain-failure",
    personas: ["developer", "ai-operator", "tech-lead"],
    surfaces: ["view", "tab", "dashboard-card"],
    maturity: "advanced",
    signal: {
      dataFreshness: "snapshot",
      confidence: "measured",
      actionability: "triage",
      cost: "low",
      latency: "interactive",
      determinism: "deterministic",
      evidenceLevel: "strong",
      decisionGrade: "triage",
    },
    related: ["planning-horizon", "agent-success", "stuck-pattern"],
    keywords: ["compounding", "error", "chain", "steps", "success"],
  },
  decision: {
    grade: "triage",
    supports: ["delegate", "approve-agent-run"],
    evidenceClass: "strong",
    failClosedEligible: false,
    humanReviewRequired: true,
  },
  actions: ["open-tab", "run-analysis", "attach-to-agent-plan"],
  workflow: {
    usableInStacks: ["agent-failure-stack", "agent-delegation-stack"],
    canBeAutoSuggested: true,
    canBeAutoAttached: true,
    requiresOrderedExecution: false,
  },
  quality: {
    maturity: "advanced",
    owner: "ai-platform",
  },
  Component: CompoundingErrorModeView,
};
