// TrajectoryDecompose view descriptor — diagnose code-agent runs by stage.
// --------------------------------------------------------------------
// Reference: TRAJEVAL (Kim et al., 2026) decomposes search/read/edit
// failures and shows why end-to-end pass@1 is too coarse for coding agents.

import type { ReactElement } from "react";
import type { Entity } from "@quanta/canvas-engine";
import type { ViewContextValue, ViewDescriptor } from "../view-mode/model/view-descriptor";
import { TrajectoryDecomposeView } from "./ui/TrajectoryDecomposeView";

function TrajectoryDecomposeModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  const entity: Entity | null = ctx.selectedId ? ctx.tree.byId.get(ctx.selectedId) ?? null : null;
  if (!entity || (entity.kind !== "building" && entity.kind !== "floor")) {
    return <TrajectoryDecomposeView ctx={ctx} empty />;
  }
  return <TrajectoryDecomposeView ctx={ctx} entity={entity} />;
}

export const trajectoryDecomposeViewDescriptor = {
  id: "trajectory-decompose",
  label: "TrajDx",
  glyph: "⇢",
  hint: "search / read / edit / verify / recover 단계별 실패 분해",
  tech: "trajectory stage precision·recall × overread ratio × bottleneck detection",
  usecase: "에이전트가 왜 망가졌는지 pass/fail 대신 단계별로 진단.",
  category: "ai",
  contexts: ["file"],
  needs: { tree: true, selection: true },
  order: 1110,
  capabilityKinds: ["view", "decision-input", "workflow-step"],
  taxonomy: {
    primary: {
      domain: "ai-agent",
      scope: "file",
      intent: "diagnose",
    },
    domains: ["ai-agent", "ai-trust-governance"],
    scopes: ["file", "task", "agent-run"],
    intents: ["diagnose", "decide"],
    subdomain: "agent-failure",
    personas: ["developer", "tech-lead", "ai-operator"],
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
      decisionGrade: "triage",
    },
    related: ["agentability", "context-waste", "anticipate"],
    keywords: ["agent", "trajectory", "failure", "search", "read", "edit", "verify"],
  },
  decision: {
    grade: "triage",
    supports: ["approve-agent-run", "delegate"],
    evidenceClass: "weak",
    humanReviewRequired: true,
  },
  actions: ["open-tab", "run-analysis", "attach-to-agent-plan"],
  workflow: {
    canBeAutoSuggested: true,
    canBeAutoAttached: true,
  },
  quality: {
    maturity: "advanced",
  },
  Component: TrajectoryDecomposeModeView,
} as ViewDescriptor;
