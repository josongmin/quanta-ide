// Agent Trajectory view descriptor — Langsmith / Traceloop style trace.
// --------------------------------------------------------------------
// Reference: Langsmith · Traceloop · Braintrust 2024-2025;
// OpenTelemetry AI semantic conventions.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { AgentTrajectoryView } from "./ui/AgentTrajectoryView";

function AgentTrajectoryModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
  const entity = ctx.selectedId ? ctx.tree.byId.get(ctx.selectedId) : null;
  if (!entity || (entity.kind !== "building" && entity.kind !== "floor")) {
    return <AgentTrajectoryView ctx={ctx} empty />;
  }
  return <AgentTrajectoryView ctx={ctx} entity={entity} />;
}

export const agentTrajectoryViewDescriptor: ViewDescriptor = {
  id: "agent-trajectory",
  label: "Trace",
  glyph: "⇢",
  hint: "에이전트 실행 트레이스 — step-by-step",
  tech: "Langsmith/Traceloop 스타일 agent trace",
  usecase: "에이전트가 뭘 했는지 재구성. 실패 스텝 디버깅.",
  category: "ai",
  contexts: ["file"],
  needs: { tree: true, selection: true },
  order: 820,
  capabilityKinds: ["view", "decision-input", "workflow-step"],
  taxonomy: {
    primary: {
      domain: "ai-agent",
      scope: "agent-run",
      intent: "explain",
    },
    scopes: ["file", "agent-run", "task"],
    intents: ["explain", "diagnose", "verify"],
    subdomain: "execution-trace",
    personas: ["developer", "ai-operator", "reviewer"],
    surfaces: ["view", "tab", "command"],
    maturity: "core",
    signal: {
      dataFreshness: "snapshot",
      confidence: "measured",
      actionability: "triage",
      cost: "medium",
      latency: "interactive",
      determinism: "deterministic",
      evidenceLevel: "strong",
      decisionGrade: "triage",
    },
    related: ["trajectory-decompose", "replay-theater", "stuck-pattern"],
    keywords: ["agent", "trajectory", "trace", "steps", "langsmith"],
  },
  decision: {
    grade: "triage",
    supports: ["approve-agent-run", "escalate-review"],
    evidenceClass: "strong",
    failClosedEligible: false,
    humanReviewRequired: true,
  },
  actions: ["open-tab", "run-analysis", "attach-to-agent-plan", "compare-related"],
  workflow: {
    usableInStacks: ["agent-failure-stack"],
    canBeAutoSuggested: true,
    canBeAutoAttached: true,
    requiresOrderedExecution: false,
  },
  quality: {
    maturity: "core",
    owner: "ai-platform",
  },
  Component: AgentTrajectoryModeView,
};
