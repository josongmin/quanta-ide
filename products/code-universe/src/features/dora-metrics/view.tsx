// DORA metrics view descriptor — Deploy Frequency / Lead Time / MTTR /
// Change Failure Rate executive dashboard.
// Reference: Forsgren, Humble, Kim — "Accelerate" (2018) + DORA State
// of DevOps reports.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { DoraMetricsView } from "./ui/DoraMetricsView";

function DoraMetricsModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
  return <DoraMetricsView ctx={ctx} />;
}

export const doraMetricsViewDescriptor: ViewDescriptor = {
  id: "dora-metrics",
  label: "DORA",
  glyph: "◈",
  hint: "DORA 4대 지표 대시보드",
  tech: "Deploy Frequency / Lead Time / MTTR / Change Fail Rate",
  usecase: "엔지니어링 성과 표준 지표. 임원 주간 보고.",
  category: "quality",
  contexts: ["repo"],
  needs: { tree: true },
  order: 360,
  Component: DoraMetricsModeView,
};
