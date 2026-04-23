// Mutation Score view — PIT / Stryker-style test-quality dashboard.
// Reference: PIT project "gold-standard test coverage"; Stryker.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { MutationScoreView } from "./ui/MutationScoreView";

function MutationScoreModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return <MutationScoreView ctx={ctx} />;
}

export const mutationScoreViewDescriptor: ViewDescriptor = {
  id: "mutation-score",
  label: "Mutation",
  glyph: "⚗",
  hint: "뮤테이션 테스트 — 테스트가 실제로 뭘 잡냐",
  tech: "PIT / Stryker mutation survival",
  usecase: "커버리지는 높은데 버그가 나오는 이유. '테스트 의미 있나' 검증.",
  category: "metrics",
  contexts: ["repo", "folder"],
  needs: { tree: true },
  order: 300,
  capabilityKinds: ["view", "decision-input", "workflow-step"],
  taxonomy: {
    primary: {
      domain: "se-testing",
      scope: "repo",
      intent: "optimize",
    },
    scopes: ["repo", "folder"],
    intents: ["optimize", "verify"],
    personas: ["developer", "reviewer", "tech-lead"],
    surfaces: ["view", "tab", "dashboard-card"],
    maturity: "advanced",
    signal: {
      dataFreshness: "snapshot",
      confidence: "measured",
      actionability: "direct-action",
      cost: "medium",
      latency: "interactive",
      determinism: "deterministic",
      evidenceLevel: "strong",
      decisionGrade: "advisory",
    },
    domains: ["se-testing", "se-quality"],
    subdomain: "mutation-analysis",
    related: ["test-pyramid", "coverage-holes", "quality-gate"],
    keywords: ["mutation", "stryker", "pit", "survival", "test-quality"],
  },
  decision: {
    grade: "advisory",
    supports: ["merge", "refactor"],
    evidenceClass: "strong",
  },
  actions: ["open-tab", "run-analysis", "compare-related", "pin-dashboard"],
  workflow: {
    canBeAutoSuggested: true,
    canBeAutoAttached: true,
  },
  quality: {
    maturity: "advanced",
    owner: "quality",
  },
  Component: MutationScoreModeView,
};
