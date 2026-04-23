// AgentSuccess view descriptor — autonomous-agent success probability
// heatmap × task.
// --------------------------------------------------------------------
// Reference: Jimenez et al. "SWE-bench", ICLR 2024; METR "Measuring AI
// Ability to Complete Long Tasks" (2024). Composite probability from
// coverage × size × complexity × AI-friendliness with a task-difficulty
// multiplier. Novel 2026 framing — "which files should you delegate to
// an autonomous agent, which need human review?"

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { AgentSuccessView } from "./ui/AgentSuccessView";

function AgentSuccessModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return <AgentSuccessView ctx={ctx} />;
}

export const agentSuccessViewDescriptor: ViewDescriptor = {
  id: "agent-success",
  label: "Agent",
  glyph: "◐",
  hint: "에이전트 성공 확률 — 태스크 × 파일",
  tech: "coverage × size × complexity × friendliness composite",
  usecase: "AI 에이전트에 맡겨도 되는 파일 vs 사람 개입 필요 파일 구분.",
  category: "ai",
  contexts: ["repo", "folder"],
  needs: { tree: true },
  order: 770,
  capabilityKinds: ["view", "decision-input", "workflow-step"],
  taxonomy: {
    primary: {
      domain: "ai-agent",
      scope: "repo",
      intent: "decide",
    },
    scopes: ["repo", "folder", "file", "task"],
    intents: ["decide", "optimize", "diagnose"],
    subdomain: "delegation-probability",
    personas: ["developer", "tech-lead", "ai-operator"],
    surfaces: ["view", "tab", "dashboard-card"],
    maturity: "core",
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
    related: ["agentability", "readiness-score", "benchmark-gap"],
    keywords: ["agent", "success", "probability", "delegate", "heatmap"],
  },
  decision: {
    grade: "advisory",
    supports: ["delegate", "approve-agent-run"],
    evidenceClass: "strong",
    failClosedEligible: false,
    humanReviewRequired: true,
  },
  actions: ["open-tab", "run-analysis", "pin-dashboard", "attach-to-agent-plan"],
  workflow: {
    usableInStacks: ["agent-delegation-stack", "agent-failure-stack"],
    canBeAutoSuggested: true,
    canBeAutoAttached: true,
    requiresOrderedExecution: false,
  },
  quality: {
    maturity: "core",
    owner: "ai-platform",
  },
  Component: AgentSuccessModeView,
};
