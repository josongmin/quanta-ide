// ThoughtTrail view descriptor — commit-sequence bubble flow.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { ThoughtTrailView } from "./ui/ThoughtTrailView";

function ThoughtTrailModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return (
    <ThoughtTrailView
      tree={ctx.tree}
      onFocusEntity={id => ctx.dispatch.selectEntity(id)}
    />
  );
}

export const thoughtTrailViewDescriptor: ViewDescriptor = {
  id: "thought-trail",
  label: "Trail",
  glyph: "⋯",
  hint: "커밋 사고의 궤적",
  tech: "commit message 임베딩 × 파일 변경",
  usecase: "'이 브랜치가 뭘 풀려고 했나' 회고. PR 설명 자동화 재료.",
  category: "history",
  contexts: ["repo", "folder"],
  needs: { tree: true },
  order: 750,
  capabilityKinds: ["view", "decision-input", "policy-control"],
  taxonomy: {
    primary: { domain: "se-evolution", scope: "diff", intent: "explain" },
    scopes: ["repo", "diff", "file"],
    intents: ["explain", "diagnose", "verify"],
    subdomain: "commit-intent-trail",
    personas: ["developer", "reviewer", "tech-lead"],
    surfaces: ["view", "tab", "dashboard-card"],
    maturity: "advanced",
    signal: {
      dataFreshness: "snapshot",
      confidence: "estimated",
      actionability: "explain",
      cost: "medium",
      latency: "interactive",
      determinism: "bounded",
      evidenceLevel: "strong",
      decisionGrade: "informational",
    },
    keywords: ["thought", "trail", "commit", "intent", "history"],
  },
  decision: {
    grade: "informational",
    supports: ["escalate-review"],
    evidenceClass: "strong",
    failClosedEligible: false,
    humanReviewRequired: false,
  },
  actions: ["open-tab", "compare-related", "pin-dashboard"],
  workflow: {
    canBeAutoSuggested: true,
    canBeAutoAttached: false,
    requiresOrderedExecution: false,
  },
  quality: {
    maturity: "advanced",
    owner: "code-intel",
  },
  Component: ThoughtTrailModeView,
};
