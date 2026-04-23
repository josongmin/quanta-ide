// AttentionMap view descriptor — per-line transformer attention visualisation.
// --------------------------------------------------------------------
// File-scoped mechanistic interpretability. For a selected file, we
// render each line with a heat bar whose width == the attention weight
// the model placed on that line when reasoning about this file. Right
// rail breaks attention down by category (code / comment / import /
// signature / return) — in practice signatures + returns dominate,
// which is itself a known transformer-circuits finding.
//
// Reference: Elhage et al. "Transformer Circuits Thread" (Anthropic).
// Templeton "Scaling Monosemanticity" Anthropic 2024. Olah et al.
// early attention visualisation work at OpenAI / Distill.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { AttentionMapView } from "./ui/AttentionMapView";

function AttentionMapModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  const entity = ctx.selectedId ? ctx.tree.byId.get(ctx.selectedId) : null;
  if (!entity || (entity.kind !== "building" && entity.kind !== "floor")) {
    return <AttentionMapView empty />;
  }
  return <AttentionMapView entity={entity} />;
}

export const attentionMapViewDescriptor: ViewDescriptor = {
  id: "attention-map",
  label: "Attention",
  glyph: "◉",
  hint: "어텐션 맵 — 모델이 실제 주목한 라인",
  tech: "mechanistic interpretability × per-line attention weight",
  usecase: "모델이 이 파일 어디를 '보고 있는지'. 수정 시 어떤 라인이 영향력 있는지.",
  category: "ai",
  contexts: ["file"],
  needs: { tree: true, selection: true },
  order: 1110,
  capabilityKinds: ["view"],
  taxonomy: {
    primary: {
      domain: "ai-trust-governance",
      scope: "file",
      intent: "explain",
    },
    scopes: ["file"],
    intents: ["explain", "explore"],
    subdomain: "mechanistic-attention",
    personas: ["developer", "tech-lead", "tech-lead"],
    surfaces: ["view", "tab"],
    maturity: "experimental",
    signal: {
      dataFreshness: "snapshot",
      confidence: "heuristic",
      actionability: "explain",
      cost: "high",
      latency: "interactive",
      determinism: "heuristic",
      evidenceLevel: "weak",
      decisionGrade: "informational",
    },
    related: ["uncertainty-map", "counterfactual", "thinking-budget"],
    keywords: ["attention", "interpretability", "lines", "weights"],
  },
  decision: {
    grade: "informational",
    supports: [],
    evidenceClass: "weak",
    failClosedEligible: false,
    humanReviewRequired: false,
  },
  actions: ["open-tab", "compare-related", "open-view"],
  workflow: {
    canBeAutoSuggested: false,
    canBeAutoAttached: false,
    requiresOrderedExecution: false,
  },
  quality: {
    maturity: "experimental",
    owner: "research",
  },
  Component: AttentionMapModeView,
};
