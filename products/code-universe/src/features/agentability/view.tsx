// Agentability view descriptor — should the agent own this task?
// --------------------------------------------------------------------
// Reference: long-horizon task success work (METR 2025) plus repository-
// specific blind spot / verification / context-load constraints.

import type { ReactElement } from "react";
import type { Entity } from "@quanta/canvas-engine";
import type { ViewContextValue, ViewDescriptor } from "../view-mode/model/view-descriptor";
import { AgentabilityView } from "./ui/AgentabilityView";

function AgentabilityModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  const entity: Entity | null = ctx.selectedId ? ctx.tree.byId.get(ctx.selectedId) ?? null : null;
  if (!entity || (entity.kind !== "building" && entity.kind !== "floor")) return <AgentabilityView ctx={ctx} empty />;
  return <AgentabilityView ctx={ctx} entity={entity} />;
}

export const agentabilityViewDescriptor = {
  id: "agentability",
  label: "AgentFit",
  glyph: "⟐",
  hint: "이 파일/태스크를 agent에게 맡길지 말지 score로 판단",
  tech: "success × horizon × verification × blind-spot × context-load composite",
  usecase: "AI-first / chunk-first / human-first 라우팅을 파일 단위에서 결정.",
  category: "ai",
  contexts: ["file"],
  needs: { tree: true, selection: true },
  order: 1140,
  capabilityKinds: ["view", "decision-input", "workflow-step"],
  taxonomy: {
    primary: {
      domain: "ai-agent",
      scope: "file",
      intent: "decide",
    },
    domains: ["ai-agent", "productivity"],
    scopes: ["file", "task"],
    intents: ["decide", "diagnose"],
    subdomain: "task-routing",
    personas: ["developer", "ai-operator", "tech-lead"],
    surfaces: ["view", "tab", "command"],
    maturity: "advanced",
    signal: {
      dataFreshness: "snapshot",
      confidence: "estimated",
      actionability: "triage",
      cost: "low",
      latency: "instant",
      determinism: "bounded",
      evidenceLevel: "weak",
      decisionGrade: "advisory",
    },
    related: ["trajectory-decompose", "context-waste", "anticipate"],
    keywords: ["agent", "fit", "ownership", "routing", "task", "verification", "context"],
  },
  decision: {
    grade: "advisory",
    supports: ["delegate"],
    evidenceClass: "weak",
  },
  actions: [
    "open-view",
    "run-analysis",
    "attach-to-agent-plan",
    "attach-to-task-routing",
  ],
  workflow: {
    canBeAutoSuggested: true,
    canBeAutoAttached: true,
  },
  quality: {
    maturity: "advanced",
  },
  Component: AgentabilityModeView,
} as ViewDescriptor;
