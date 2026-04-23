// StuckPattern view descriptor — agent oscillation / repeat-error sessions.
// --------------------------------------------------------------------
// Reference: Valmeekam "Can LLMs Really Plan?" 2024; Kapoor et al. "AI
// Agent Failure Modes" 2024; plus the 2025-26 line of work treating
// stuck-pattern detection as an emerging agent-reliability metric.
// Classifies historical sessions into 4 patterns (same-error, oscillation,
// tool-loop, assertion-thrash) with repeat count, duration, escape route.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { StuckPatternView } from "./ui/StuckPatternView";

function StuckPatternModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return <StuckPatternView ctx={ctx} />;
}

export const stuckPatternViewDescriptor: ViewDescriptor = {
  id: "stuck-pattern",
  label: "Stuck",
  glyph: "⊗",
  hint: "에이전트 고립 패턴 — 반복 실패",
  tech: "4-pattern 분류 × repeat count × escape verdict",
  usecase: "에이전트 사용 불가능 상태 진입 조건 식별. 자동 개입 규칙 트리거.",
  category: "ai",
  contexts: ["repo"],
  needs: { tree: true },
  order: 1100,
  capabilityKinds: ["view", "decision-input", "workflow-step", "policy-control"],
  taxonomy: {
    primary: {
      domain: "ai-agent",
      scope: "task",
      intent: "govern",
    },
    scopes: ["repo", "agent-run", "task"],
    intents: ["diagnose", "govern", "decide"],
    subdomain: "stuck-detection",
    personas: ["ai-operator", "developer", "manager"],
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
    related: ["agent-trajectory", "replay-theater", "convergence-score"],
    keywords: ["stuck", "pattern", "oscillation", "loop", "escape"],
  },
  decision: {
    grade: "triage",
    supports: ["escalate-review", "approve-agent-run"],
    evidenceClass: "strong",
    failClosedEligible: false,
    humanReviewRequired: true,
  },
  actions: ["open-tab", "run-analysis", "attach-to-agent-plan", "pin-dashboard"],
  workflow: {
    usableInStacks: ["agent-failure-stack"],
    canBeAutoSuggested: true,
    canBeAutoAttached: true,
    requiresOrderedExecution: false,
  },
  quality: {
    maturity: "advanced",
    owner: "ai-platform",
  },
  Component: StuckPatternModeView,
};
