// RefactoringMiner view descriptor — timeline of historical refactorings.
// Reference: Tsantalis et al. "Accurate and Efficient Refactoring Detection
// in Commit History", ICSE 2018 (RefactoringMiner).

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { RefactoringMinerView } from "./ui/RefactoringMinerView";

function RefactoringMinerModeView({
  ctx,
}: {
  ctx: ViewContextValue;
}): ReactElement | null {
  if (!ctx.tree) return null;
  if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
  return <RefactoringMinerView ctx={ctx} />;
}

export const refactoringMinerViewDescriptor: ViewDescriptor = {
  id: "refactoring-miner",
  label: "RefHistory",
  glyph: "↻",
  hint: "과거 리팩터링 자동 탐지",
  tech: "RefactoringMiner (Tsantalis ICSE 2018) 스타일 출력",
  usecase: "팀 스타일 분석. 온보딩 자료. '우리는 언제 Extract Method 많이 했나' 회고.",
  category: "history",
  contexts: ["repo", "folder"],
  needs: { tree: true },
  order: 730,
  capabilityKinds: ["view", "decision-input", "policy-control"],
  taxonomy: {
    primary: { domain: "se-refactor-change", scope: "repo", intent: "explain" },
    scopes: ["repo", "package", "file"],
    intents: ["explain", "verify", "optimize"],
    subdomain: "refactor-history",
    personas: ["developer", "tech-lead", "manager"],
    surfaces: ["view", "tab", "dashboard-card"],
    maturity: "advanced",
    signal: {
      dataFreshness: "snapshot",
      confidence: "measured",
      actionability: "explain",
      cost: "medium",
      latency: "interactive",
      determinism: "bounded",
      evidenceLevel: "strong",
      decisionGrade: "informational",
    },
    keywords: ["refactor", "history", "miner", "extract", "rename"],
  },
  decision: {
    grade: "informational",
    supports: ["refactor", "policy-audit"],
    evidenceClass: "strong",
    failClosedEligible: false,
    humanReviewRequired: false,
  },
  actions: ["open-tab", "run-analysis", "compare-related", "pin-dashboard"],
  workflow: {
    canBeAutoSuggested: true,
    canBeAutoAttached: false,
    requiresOrderedExecution: false,
  },
  quality: {
    maturity: "advanced",
    owner: "code-intel",
  },
  Component: RefactoringMinerModeView,
};
