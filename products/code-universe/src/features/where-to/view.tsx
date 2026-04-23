// WhereTo view descriptor — "where should I put this?" folder heat search.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { WhereToView } from "./ui/WhereToView";

function WhereToModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return (
    <WhereToView
      tree={ctx.tree}
      selectedId={ctx.selectedId}
      onFocusEntity={id => ctx.dispatch.selectEntity(id)}
    />
  );
}

export const whereToViewDescriptor: ViewDescriptor = {
  id: "where-to",
  label: "Where?",
  glyph: "?",
  hint: "여기 추가하면 어디?",
  tech: "키워드 × 임베딩 (AST 요약 벡터)",
  usecase: "새 기능 위치 찾기. 온보딩된 주니어한테도 친절.",
  category: "explore",
  contexts: ["repo", "folder"],
  needs: { tree: true },
  order: 80,
  capabilityKinds: ["view", "decision-input", "workflow-step"],
  taxonomy: {
    primary: { domain: "se-architecture", scope: "folder", intent: "decide" },
    scopes: ["repo", "folder", "file"],
    intents: ["decide", "explore", "explain"],
    subdomain: "placement-guidance",
    personas: ["developer", "reviewer", "tech-lead"],
    surfaces: ["view", "tab", "command"],
    maturity: "core",
    signal: {
      dataFreshness: "snapshot",
      confidence: "estimated",
      actionability: "direct-action",
      cost: "medium",
      latency: "interactive",
      determinism: "bounded",
      evidenceLevel: "strong",
      decisionGrade: "advisory",
    },
    keywords: ["where-to", "placement", "feature", "folder", "architecture"],
  },
  decision: {
    grade: "advisory",
    supports: ["refactor", "delegate"],
    evidenceClass: "strong",
    failClosedEligible: false,
    humanReviewRequired: false,
  },
  actions: ["open-tab", "run-analysis", "compare-related"],
  workflow: {
    canBeAutoSuggested: true,
    canBeAutoAttached: true,
    requiresOrderedExecution: false,
  },
  quality: {
    maturity: "core",
    owner: "code-intel",
  },
  Component: WhereToModeView,
};
