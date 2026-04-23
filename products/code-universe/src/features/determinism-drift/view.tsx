// DeterminismDrift view descriptor — same-prompt output variance over time.
// --------------------------------------------------------------------
// Reference: Holtzman et al. "The Curious Case of Neural Text Degeneration
// (Nucleus Sampling)" ICLR 2020; Achiam et al. "Determinism in LLMs"
// (practitioner write-ups); Anthropic model release notes and their
// observed downstream workflow impact (2025).

import type { ReactElement } from "react";
import type { Entity } from "@quanta/canvas-engine";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { DeterminismDriftView } from "./ui/DeterminismDriftView";

function DeterminismDriftModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
  const entity: Entity | null = ctx.selectedId ? ctx.tree.byId.get(ctx.selectedId) ?? null : null;
  if (!entity || (entity.kind !== "building" && entity.kind !== "floor")) {
    return <DeterminismDriftView ctx={ctx} empty />;
  }
  return <DeterminismDriftView ctx={ctx} entity={entity} />;
}

export const determinismDriftViewDescriptor: ViewDescriptor = {
  id: "determinism-drift",
  label: "Drift",
  glyph: "∿",
  hint: "동일 프롬프트 출력 표류 — 주간",
  tech: "12주 output hash bucket × drift 이벤트 감지",
  usecase: "모델 업데이트가 내 워크플로우 망가뜨리는 순간 포착.",
  category: "ai",
  contexts: ["file"],
  needs: { tree: true, selection: true },
  order: 1080,
  capabilityKinds: ["view", "decision-input"],
  taxonomy: {
    primary: {
      domain: "ai-context-model",
      scope: "model",
      intent: "diagnose",
    },
    scopes: ["file", "model", "task"],
    intents: ["diagnose", "verify", "govern"],
    subdomain: "output-drift",
    personas: ["ai-operator", "developer"],
    surfaces: ["view", "tab"],
    maturity: "advanced",
    signal: {
      dataFreshness: "snapshot",
      confidence: "measured",
      actionability: "triage",
      cost: "medium",
      latency: "interactive",
      determinism: "bounded",
      evidenceLevel: "strong",
      decisionGrade: "triage",
    },
    related: ["model-swap-sim", "planning-horizon", "uncertainty-map"],
    keywords: ["determinism", "drift", "weekly", "bucket", "release"],
  },
  decision: {
    grade: "triage",
    supports: ["route-model", "approve-agent-run"],
    evidenceClass: "strong",
    failClosedEligible: false,
    humanReviewRequired: true,
  },
  actions: ["open-tab", "run-analysis", "compare-related"],
  workflow: {
    usableInStacks: ["context-engineering-stack", "agent-failure-stack"],
    canBeAutoSuggested: true,
    canBeAutoAttached: false,
    requiresOrderedExecution: false,
  },
  quality: {
    maturity: "advanced",
    owner: "ai-platform",
  },
  Component: DeterminismDriftModeView,
};
