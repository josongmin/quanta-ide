// PlanningHorizon view descriptor — per-task reliable plan depth.
// --------------------------------------------------------------------
// Reference: METR "Measuring AI Ability to Complete Long Tasks" 2024;
// Valmeekam et al. "PlanBench" 2024; Wei et al. "Chain-of-Thought
// Prompting Elicits Reasoning in Large Language Models" NeurIPS 2022.
// Translates compounding-error into task-specific horizons: where each
// task reliably holds ≥80%, where it drops below 50%, and what the full
// decay curve looks like for chunking decisions.

import type { ReactElement } from "react";
import type { Entity } from "@quanta/canvas-engine";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { PlanningHorizonView } from "./ui/PlanningHorizonView";

function PlanningHorizonModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
  const entity: Entity | null = ctx.selectedId ? ctx.tree.byId.get(ctx.selectedId) ?? null : null;
  if (!entity || (entity.kind !== "building" && entity.kind !== "floor")) {
    return <PlanningHorizonView ctx={ctx} empty />;
  }
  return <PlanningHorizonView ctx={ctx} entity={entity} />;
}

export const planningHorizonViewDescriptor: ViewDescriptor = {
  id: "planning-horizon",
  label: "Horizon",
  glyph: "◷",
  hint: "태스크별 계획 지평선 — 몇 step까지 reliable",
  tech: "per-step accuracy^k × task-specific curves",
  usecase: "복잡 태스크 쪼개기 결정. 'refactor는 6 step 이하로 분해'.",
  category: "ai",
  contexts: ["file"],
  needs: { tree: true, selection: true },
  order: 1090,
  capabilityKinds: ["view", "decision-input", "workflow-step"],
  taxonomy: {
    primary: {
      domain: "ai-agent",
      scope: "agent-run",
      intent: "decide",
    },
    scopes: ["file", "task", "agent-run"],
    intents: ["decide", "diagnose", "optimize"],
    subdomain: "planning-depth",
    personas: ["developer", "ai-operator", "tech-lead"],
    surfaces: ["view", "tab", "command"],
    maturity: "advanced",
    signal: {
      dataFreshness: "snapshot",
      confidence: "estimated",
      actionability: "direct-action",
      cost: "low",
      latency: "interactive",
      determinism: "deterministic",
      evidenceLevel: "strong",
      decisionGrade: "advisory",
    },
    related: ["compounding-error", "turn-depth", "agentability"],
    keywords: ["planning", "horizon", "steps", "chunk", "reliable"],
  },
  decision: {
    grade: "advisory",
    supports: ["delegate", "approve-agent-run"],
    evidenceClass: "strong",
    failClosedEligible: false,
    humanReviewRequired: false,
  },
  actions: ["open-tab", "run-analysis", "attach-to-agent-plan"],
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
  Component: PlanningHorizonModeView,
};
