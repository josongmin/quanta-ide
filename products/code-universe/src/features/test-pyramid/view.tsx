// Test Pyramid view descriptor — Cohn 2009 / Fowler testing pyramid.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { TestPyramidView } from "./ui/TestPyramidView";

function TestPyramidModeView({
  ctx,
}: {
  ctx: ViewContextValue;
}): ReactElement | null {
  if (!ctx.tree) return null;
  if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
  return <TestPyramidView ctx={ctx} />;
}

export const testPyramidViewDescriptor: ViewDescriptor = {
  id: "test-pyramid",
  label: "Pyramid",
  glyph: "△",
  hint: "테스트 피라미드 — unit / integration / e2e",
  tech: "테스트 파일 분류 × LoC 비율",
  usecase:
    "테스트 전략 건강도. 아이스크림콘/다이아몬드 모양 경고.",
  category: "metrics",
  contexts: ["repo", "folder"],
  needs: { tree: true },
  order: 280,
  capabilityKinds: ["view", "decision-input", "workflow-step"],
  taxonomy: {
    primary: {
      domain: "se-testing",
      scope: "folder",
      intent: "verify",
    },
    scopes: ["folder", "repo"],
    intents: ["verify", "optimize"],
    personas: ["developer", "reviewer", "tech-lead"],
    surfaces: ["view", "tab", "dashboard-card"],
    maturity: "core",
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
    subdomain: "test-strategy",
    related: ["coverage-holes", "mutation-score", "quality-gate"],
    keywords: ["test-pyramid", "unit", "integration", "e2e", "strategy"],
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
    requiresOrderedExecution: true,
  },
  quality: {
    maturity: "core",
    owner: "quality",
  },
  Component: TestPyramidModeView,
};
