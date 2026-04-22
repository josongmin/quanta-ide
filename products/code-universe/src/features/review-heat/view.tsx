// ReviewHeat view descriptor — code-review cycle time × comment density.
// Reference: Baysal et al. "The Influence of Non-Technical Factors on
// Code Review", MSR 2013.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { ReviewHeatView } from "./ui/ReviewHeatView";

function ReviewHeatModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
  return <ReviewHeatView ctx={ctx} />;
}

export const reviewHeatViewDescriptor: ViewDescriptor = {
  id: "review-heat",
  label: "Review",
  glyph: "◔",
  hint: "코드리뷰 병목 — cycle time × comment 밀도",
  tech: "PR lifecycle × review discussion 분석",
  usecase: "리뷰 지연 원인 시각화. DevOps 개선 데이터.",
  category: "team",
  contexts: ["repo", "folder"],
  needs: { tree: true },
  order: 630,
  Component: ReviewHeatModeView,
};
