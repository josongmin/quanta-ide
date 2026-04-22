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
  Component: ReviewRecommenderModeView,
};
