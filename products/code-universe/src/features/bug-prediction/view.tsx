// BugPrediction view descriptor — defect-likelihood heatmap.
// --------------------------------------------------------------------
// Weighted combination of complexity, churn and coupling produces a
// per-file bug-probability score. The view renders the result as a
// folder-nested grid of tiles coloured by risk (red / amber / green).
//
// Reference: Zimmermann PROMISE 2007 ("Predicting Defects for Eclipse")
//            + Nagappan & Ball MSR work on churn-based defect models.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { BugPredictionView } from "./ui/BugPredictionView";

function BugPredictionModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
  return <BugPredictionView ctx={ctx} />;
}

export const bugPredictionViewDescriptor: ViewDescriptor = {
  id: "bug-prediction",
  label: "BugRisk",
  glyph: "◑",
  hint: "결함 예측 — 복잡도+churn+결합도 모델",
  tech: "Zimmermann/Nagappan defect prediction weighted sum",
  usecase: "어디서 다음 버그 터질지 사전 경고. 코드리뷰 우선순위.",
  category: "metrics",
  contexts: ["repo", "folder"],
  needs: { tree: true },
  order: 310,
  Component: BugPredictionModeView,
};
