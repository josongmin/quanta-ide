// ContextWaste view descriptor — where long prompt budget gets burned.
// --------------------------------------------------------------------
// Reference: Lost in the Middle (Liu et al., TACL 2024); Context Length
// Alone Hurts LLM Performance Despite Perfect Retrieval (Du et al., 2025).

import type { ReactElement } from "react";
import type { Entity } from "@quanta/canvas-engine";
import type { ViewContextValue, ViewDescriptor } from "../view-mode/model/view-descriptor";
import { ContextWasteView } from "./ui/ContextWasteView";

function ContextWasteModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  const entity: Entity | null = ctx.selectedId ? ctx.tree.byId.get(ctx.selectedId) ?? null : null;
  if (!entity || (entity.kind !== "building" && entity.kind !== "floor")) {
    return <ContextWasteView ctx={ctx} empty />;
  }
  return <ContextWasteView ctx={ctx} entity={entity} />;
}

export const contextWasteViewDescriptor = {
  id: "context-waste",
  label: "CtxWaste",
  glyph: "◫",
  hint: "실제로 안 쓰인 토큰과 middle-loss 위험을 보여줌",
  tech: "context slice utilization × minimum viable prompt × freshness risk",
  usecase: "긴 프롬프트가 왜 비싸고 왜 성능을 깎는지 slice 단위로 확인.",
  category: "ai",
  contexts: ["file"],
  needs: { tree: true, selection: true },
  order: 1120,
  capabilityKinds: ["view", "decision-input", "workflow-step"],
  taxonomy: {
    primary: {
      domain: "ai-context-model",
      scope: "file",
      intent: "optimize",
    },
    domains: ["ai-context-model", "ai-agent"],
    scopes: ["file", "task", "budget"],
    intents: ["optimize", "diagnose"],
    subdomain: "prompt-budget",
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
    related: ["agentability", "trajectory-decompose", "prompt-simulator"],
    keywords: ["context", "budget", "prompt", "middle", "freshness", "token"],
  },
  decision: {
    grade: "advisory",
    supports: ["delegate", "route-model"],
    evidenceClass: "weak",
  },
  actions: ["open-tab", "run-analysis", "attach-to-agent-plan"],
  workflow: {
    canBeAutoSuggested: true,
    canBeAutoAttached: true,
  },
  quality: {
    maturity: "advanced",
  },
  Component: ContextWasteModeView,
} as ViewDescriptor;
