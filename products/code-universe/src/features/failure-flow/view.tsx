// FailureFlow view descriptor — error throw/catch propagation graph.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { FailureFlowView } from "./ui/FailureFlowView";

function FailureFlowModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return (
    <FailureFlowView
      tree={ctx.tree}
      onFocusEntity={id => ctx.dispatch.selectEntity(id)}
    />
  );
}

export const failureFlowViewDescriptor: ViewDescriptor = {
  id: "failure-flow",
  label: "Flow",
  glyph: "⚠",
  hint: "에러 전파 경로",
  tech: "throw/catch AST 스캔 × 함수 그래프",
  usecase: "잘못 흐르는 에러 / uncaught 식별. 안정성 감사.",
  category: "deps",
  contexts: ["repo", "folder"],
  needs: { tree: true },
  order: 200,
  capabilityKinds: ["view", "decision-input"],
  taxonomy: {
    primary: {
      domain: "se-quality",
      scope: "module",
      intent: "verify",
    },
    scopes: ["repo", "folder", "module"],
    intents: ["diagnose", "verify"],
    subdomain: "error-propagation",
    personas: ["developer", "tech-lead"],
    surfaces: ["view", "tab"],
    maturity: "advanced",
    signal: {
      dataFreshness: "snapshot",
      confidence: "measured",
      actionability: "triage",
      cost: "medium",
      latency: "interactive",
      determinism: "deterministic",
      evidenceLevel: "strong",
      decisionGrade: "triage",
    },
    related: ["control-flow", "program-slice", "vulnerabilities"],
    keywords: ["failure", "flow", "throw", "catch", "uncaught"],
  },
  decision: {
    grade: "triage",
    supports: ["escalate-review"],
    evidenceClass: "strong",
    failClosedEligible: false,
    humanReviewRequired: true,
  },
  actions: ["open-tab", "run-analysis", "compare-related"],
  workflow: {
    canBeAutoSuggested: true,
    canBeAutoAttached: false,
    requiresOrderedExecution: false,
  },
  quality: {
    maturity: "advanced",
    owner: "platform",
  },
  Component: FailureFlowModeView,
};
