// SemanticNeighbors view descriptor — embedding-based nearest files.
// --------------------------------------------------------------------
// Reference: Feng et al. "CodeBERT: A Pre-Trained Model for Programming
// and Natural Languages" EMNLP 2020; Alon et al. "code2vec: Learning
// Distributed Representations of Code" POPL 2019; OpenAI text-embedding-
// ada-002. Distinct from `file-twins` (structural + co-change + name).
// This view uses pure embedding cosine distance — finds files that
// "mean the same thing" even when they share no structural features.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { SemanticNeighborsView } from "./ui/SemanticNeighborsView";

function SemanticNeighborsModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  const entity = ctx.selectedId ? ctx.tree.byId.get(ctx.selectedId) : null;
  if (!entity || (entity.kind !== "building" && entity.kind !== "floor")) {
    return <SemanticNeighborsView ctx={ctx} empty />;
  }
  return <SemanticNeighborsView ctx={ctx} entity={entity} />;
}

export const semanticNeighborsViewDescriptor: ViewDescriptor = {
  id: "semantic-neighbors",
  label: "SemNeigh",
  glyph: "⁕",
  hint: "의미 임베딩 이웃 — 구조 유사 아닌 의미 유사",
  tech: "CodeBERT / ada-002 임베딩 × 코사인 거리",
  usecase: "구조적 twin 못 잡는 의미 유사 발견. 중복 개념 clustering.",
  category: "ai",
  contexts: ["file"],
  needs: { tree: true, selection: true },
  order: 780,
  capabilityKinds: ["view"],
  taxonomy: {
    primary: {
      domain: "explore",
      scope: "symbol",
      intent: "explore",
    },
    scopes: ["file", "symbol"],
    intents: ["explore", "explain"],
    subdomain: "semantic-neighborhood",
    personas: ["developer"],
    surfaces: ["view", "tab"],
    maturity: "advanced",
    signal: {
      dataFreshness: "snapshot",
      confidence: "estimated",
      actionability: "explain",
      cost: "medium",
      latency: "interactive",
      determinism: "heuristic",
      evidenceLevel: "weak",
      decisionGrade: "informational",
    },
    related: ["embedding", "file-twins", "neighborhood"],
    keywords: ["semantic", "neighbors", "embedding", "similarity"],
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
    maturity: "advanced",
    owner: "ai-platform",
  },
  Component: SemanticNeighborsModeView,
};
