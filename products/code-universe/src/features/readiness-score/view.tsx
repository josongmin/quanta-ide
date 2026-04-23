// Readiness Score view descriptor — repo-wide agent-readiness composite.
// --------------------------------------------------------------------
// Reference: OpenAI GPTs readiness · Codeium AI-readiness score ·
// Anthropic "Preparing your codebase for Claude" 2024.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { ReadinessScoreView } from "./ui/ReadinessScoreView";

function ReadinessScoreModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
  return <ReadinessScoreView ctx={ctx} />;
}

export const readinessScoreViewDescriptor: ViewDescriptor = {
  id: "readiness-score",
  label: "Ready",
  glyph: "⚑",
  hint: "에이전트 투입 준비도",
  tech: "docs×tests×types×naming×commits×arch 6-factor composite",
  usecase: "AI 대시보드 핵심. 'AI 돌리기 전 뭘 먼저 손봐야?' 답.",
  category: "ai",
  contexts: ["repo"],
  needs: { tree: true },
  order: 860,
  capabilityKinds: ["view", "decision-input", "workflow-step", "policy-control"],
  taxonomy: {
    primary: {
      domain: "ai-agent",
      scope: "repo",
      intent: "govern",
    },
    scopes: ["repo", "team", "task"],
    intents: ["decide", "optimize", "govern"],
    subdomain: "agent-readiness",
    personas: ["manager", "tech-lead", "ai-operator"],
    surfaces: ["view", "tab", "dashboard-card"],
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
    related: ["agent-success", "agentability", "review-burden"],
    keywords: ["readiness", "score", "docs", "tests", "types"],
  },
  decision: {
    grade: "advisory",
    supports: ["delegate", "approve-agent-run"],
    evidenceClass: "strong",
    failClosedEligible: false,
    humanReviewRequired: false,
  },
  actions: ["open-tab", "run-analysis", "pin-dashboard", "attach-to-task-routing"],
  workflow: {
    usableInStacks: ["agent-delegation-stack"],
    canBeAutoSuggested: true,
    canBeAutoAttached: true,
    requiresOrderedExecution: false,
  },
  quality: {
    maturity: "core",
    owner: "ai-platform",
  },
  Component: ReadinessScoreModeView,
};
