// Heat Rainfall view descriptor — commits fall like rain onto dependents.
// --------------------------------------------------------------------
// A "cloud" (the currently-selected file or top-churn file when none is
// selected) sheds raindrops onto a grid of its dependent files whenever
// a synthesized commit event fires. Each hit flashes the target. Legend
// shows a rolling 10-minute raindrop count.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { HeatRainfallView } from "./ui/HeatRainfallView";

function HeatRainfallModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree || !ctx.graph) return null;
  if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
  return <HeatRainfallView ctx={ctx} />;
}

export const heatRainfallViewDescriptor: ViewDescriptor = {
  id: "heat-rainfall",
  label: "Rain",
  glyph: "☂",
  hint: "의존성 강우 — 최근 변경의 파급",
  tech: "git log stream × 의존성 전파",
  usecase: "'어디가 비 맞고 있나'. 커밋 흐름 시각화.",
  category: "history",
  contexts: ["repo", "folder", "file"],
  needs: { tree: true, graph: true },
  order: 790,
  Component: HeatRainfallModeView,
};
