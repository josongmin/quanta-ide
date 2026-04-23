// Semantic Diff view — symbol-level diff between two commits.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { SemanticDiffView } from "./ui/SemanticDiffView";

function SemanticDiffModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return <SemanticDiffView ctx={ctx} />;
}

export const semanticDiffViewDescriptor: ViewDescriptor = {
  id: "semantic-diff",
  label: "Diff",
  glyph: "⇄",
  hint: "의미 단위 diff — 심볼 변화 버블"
,
  tech: "AST × git blame 교차 — add / remove / rename / move",
  usecase: "line diff 대신 '무엇이 추가됐고 옮겨갔는지' 시각화. 리뷰 속도 가속.",
  category: "history",
  contexts: ["repo", "folder"],
  needs: { tree: true },
  order: 700,
  capabilityKinds: ["view", "decision-input", "workflow-step"],
  taxonomy: {
    primary: { domain: "se-refactor-change", scope: "diff", intent: "verify" },
    scopes: ["diff", "file", "symbol"],
    intents: ["verify", "diagnose", "explain"],
    subdomain: "semantic-diff",
    personas: ["developer", "reviewer", "tech-lead"],
    surfaces: ["view", "tab", "diff-inline"],
    maturity: "core",
    signal: {
      dataFreshness: "snapshot",
      confidence: "measured",
      actionability: "direct-action",
      cost: "medium",
      latency: "interactive",
      determinism: "bounded",
      evidenceLevel: "strong",
      decisionGrade: "advisory",
    },
    keywords: ["semantic", "diff", "symbol", "review", "rename"],
  },
  decision: {
    grade: "advisory",
    supports: ["merge", "refactor"],
    evidenceClass: "strong",
    failClosedEligible: false,
    humanReviewRequired: false,
  },
  actions: ["open-tab", "run-analysis", "attach-to-pr-review", "compare-related"],
  workflow: {
    canBeAutoSuggested: true,
    canBeAutoAttached: true,
    requiresOrderedExecution: false,
  },
  quality: {
    maturity: "core",
    owner: "code-intel",
  },
  Component: SemanticDiffModeView,
};
