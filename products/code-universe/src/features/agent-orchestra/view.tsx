// AgentOrchestra view descriptor.
// --------------------------------------------------------------------
// Multi-agent pipeline config — 5-role chain (planner → coder →
// reviewer → tester → documenter) with per-step model / cost /
// success-rate.
//
// Reference: LangGraph multi-agent; CrewAI; Anthropic "Building
// effective agents" (2024); AutoGen (Microsoft 2023).

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { AgentOrchestraView } from "./ui/AgentOrchestraView";

function AgentOrchestraModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
  return <AgentOrchestraView ctx={ctx} />;
}

export const agentOrchestraViewDescriptor: ViewDescriptor = {
  id: "agent-orchestra",
  label: "Orchestra",
  glyph: "♜",
  hint: "다중 에이전트 파이프라인",
  tech: "5-role pipeline (planner→coder→reviewer→tester→documenter)",
  usecase: "단일 LLM보다 분업이 효과적인 복잡 태스크. 역할별 최적 모델 라우팅.",
  category: "ai",
  contexts: ["repo"],
  needs: { tree: true },
  order: 980,
  capabilityKinds: ["view", "decision-input", "workflow-step"],
  taxonomy: {
    primary: {
      domain: "ai-agent",
      scope: "model",
      intent: "optimize",
    },
    scopes: ["task", "agent-run", "model"],
    intents: ["decide", "optimize", "govern"],
    subdomain: "multi-agent-pipeline",
    personas: ["ai-operator", "manager", "tech-lead"],
    surfaces: ["view", "tab", "dashboard-card"],
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
    related: ["task-composer", "model-router", "agent-success"],
    keywords: ["agent", "orchestra", "pipeline", "roles", "routing"],
  },
  decision: {
    grade: "advisory",
    supports: ["delegate", "route-model", "approve-agent-run"],
    evidenceClass: "strong",
    failClosedEligible: false,
    humanReviewRequired: false,
  },
  actions: ["open-tab", "run-analysis", "attach-to-agent-plan", "pin-dashboard"],
  workflow: {
    usableInStacks: ["agent-delegation-stack", "agent-failure-stack"],
    canBeAutoSuggested: true,
    canBeAutoAttached: true,
    requiresOrderedExecution: false,
  },
  quality: {
    maturity: "advanced",
    owner: "ai-platform",
  },
  Component: AgentOrchestraModeView,
};
