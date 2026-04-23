// ReviewRecommender view descriptor — reviewer suggestion for a PR.
// --------------------------------------------------------------------
// References:
//   Xie et al. "ReviewBot: mining reviewer expertise" (MSR 2015)
//   Ying et al. "Predicting source code changes by mining change history"
//     (FSE 2004)
//   Google Code Review reviewer suggestion (Sadowski et al. 2018).
//
// The view synthesizes a "changed set" from the current selection +
// siblings, then scores each candidate author by past blame on those
// files, area expertise (parent-folder overlap), and recency.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { ReviewRecommenderView } from "./ui/ReviewRecommenderView";

function ReviewRecommenderModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
  return <ReviewRecommenderView ctx={ctx} />;
}

export const reviewRecommenderViewDescriptor: ViewDescriptor = {
  id: "review-recommender",
  label: "Review?",
  glyph: "⌘",
  hint: "리뷰어 추천 — 과거 기여 기반",
  tech: "past blame × 영역 전문성 × 최근 활성도",
  usecase: "PR 리뷰어 라우팅 자동화. truck-factor 보완 (누구한테 맡기면 좋냐).",
  category: "team",
  contexts: ["repo", "folder", "file"],
  needs: { tree: true },
  order: 640,
  capabilityKinds: ["view", "decision-input", "workflow-step"],
  taxonomy: {
    primary: {
      domain: "se-ownership-team",
      scope: "file",
      intent: "decide",
    },
    scopes: ["file", "folder", "repo"],
    intents: ["decide", "diagnose"],
    personas: ["manager", "tech-lead", "developer"],
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
    domains: ["se-ownership-team", "productivity"],
    subdomain: "review-routing",
    related: ["review-heat", "ownership-sankey", "author-territory"],
    keywords: ["reviewer", "blame", "expertise", "routing", "pr"],
  },
  decision: {
    grade: "advisory",
    supports: ["delegate", "escalate-review"],
    evidenceClass: "strong",
  },
  actions: ["open-tab", "run-analysis", "attach-to-pr-review", "attach-to-task-routing"],
  workflow: {
    canBeAutoSuggested: true,
    canBeAutoAttached: true,
  },
  quality: {
    maturity: "advanced",
    owner: "team",
  },
  Component: ReviewRecommenderModeView,
};
