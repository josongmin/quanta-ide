// Turn Depth view descriptor — task-turn + replan analysis.
// --------------------------------------------------------------------
// Reference: Anthropic agentic behavior studies 2024; "Measuring AI
// agent brittleness" emerging field (ReAct, Reflexion follow-ups).

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { TurnDepthView } from "./ui/TurnDepthView";

function TurnDepthModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
  const entity = ctx.selectedId ? ctx.tree.byId.get(ctx.selectedId) : null;
  if (!entity || (entity.kind !== "building" && entity.kind !== "floor")) {
    return <TurnDepthView ctx={ctx} empty />;
  }
  return <TurnDepthView ctx={ctx} entity={entity} />;
}

export const turnDepthViewDescriptor: ViewDescriptor = {
  id: "turn-depth",
  label: "Turns",
  glyph: "↻",
  hint: "턴 깊이 · 재계획 빈도",
  tech: "태스크별 p50/p95 turn × replan rate",
  usecase: "자주 재계획하면 brittle. 태스크 복잡도 현실 체크.",
  category: "ai",
  contexts: ["file"],
  needs: { tree: true, selection: true },
  order: 840,
  capabilityKinds: ["view", "decision-input", "workflow-step"],
  taxonomy: {
    primary: {
      domain: "ai-agent",
      scope: "task",
      intent: "diagnose",
    },
    scopes: ["file", "task", "agent-run"],
    intents: ["diagnose", "optimize", "decide"],
    subdomain: "turn-economics",
    personas: ["developer", "ai-operator"],
    surfaces: ["view", "tab"],
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
    related: ["agent-trajectory", "planning-horizon", "convergence-score"],
    keywords: ["turn", "depth", "replan", "p95", "brittle"],
  },
  decision: {
    grade: "triage",
    supports: ["approve-agent-run", "delegate"],
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
  Component: TurnDepthModeView,
};
