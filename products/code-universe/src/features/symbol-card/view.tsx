// SymbolCard — descriptor for the per-symbol hero card.
// --------------------------------------------------------------------
// Reference: Sourcetrail symbol-detail pane; LSP "peek definition".
// Centers on ONE symbol inside the selected file — signature at top,
// mini-stats (LoC · CC · CogC · visibility · callers · callees · tests),
// a "Tests" side panel listing covering tests, and a "Definition
// preview" block with a mock function body so the card reads as a
// proper peek-definition surface.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { SymbolCardView } from "./ui/SymbolCardView";

function SymbolCardModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return <SymbolCardView ctx={ctx} />;
}

export const symbolCardViewDescriptor: ViewDescriptor = {
  id: "symbol-card",
  label: "Symbol",
  glyph: "⊙",
  hint: "심볼 카드 — 정의 × 호출처 × 테스트",
  tech: "AST symbol extraction × usage index × test linkage",
  usecase: "심볼 한 개 완전 이해. IDE 피쳐의 시각화 버전.",
  category: "explore",
  contexts: ["file"],
  needs: { tree: true, selection: true },
  order: 100,
  capabilityKinds: ["view", "decision-input"],
  taxonomy: {
    primary: { domain: "explore", scope: "symbol", intent: "explain" },
    scopes: ["file", "symbol", "module"],
    intents: ["explain", "verify", "explore"],
    subdomain: "symbol-knowledge-card",
    personas: ["developer", "reviewer", "tech-lead"],
    surfaces: ["view", "hover", "tab"],
    maturity: "core",
    signal: {
      dataFreshness: "snapshot",
      confidence: "measured",
      actionability: "explain",
      cost: "low",
      latency: "instant",
      determinism: "deterministic",
      evidenceLevel: "strong",
      decisionGrade: "informational",
    },
    keywords: ["symbol", "card", "definition", "usage", "tests"],
  },
  decision: {
    grade: "informational",
    supports: ["merge", "delegate"],
    evidenceClass: "strong",
    failClosedEligible: false,
    humanReviewRequired: false,
  },
  actions: ["open-view", "open-tab", "compare-related"],
  workflow: {
    canBeAutoSuggested: true,
    canBeAutoAttached: false,
    requiresOrderedExecution: false,
  },
  quality: {
    maturity: "core",
    owner: "code-intel",
  },
  Component: SymbolCardModeView,
};
