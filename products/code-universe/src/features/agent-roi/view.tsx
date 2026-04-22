// AgentROI view descriptor — monthly AI cost-vs-value series.
// --------------------------------------------------------------------
// Reference: "AI productivity metrics" 2025 research consensus; Copilot
// and Cursor ROI studies (ZoomInfo 2024; Gartner 2025). Imputes value
// from PRs merged + bugs fixed against logged token spend so leadership
// can answer "did the AI spend pay back?".

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { AgentROIView } from "./ui/AgentROIView";

function AgentROIModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
  return <AgentROIView ctx={ctx} />;
}

export const agentROIViewDescriptor: ViewDescriptor = {
  id: "agent-roi",
  label: "ROI",
  glyph: "↗",
  hint: "AI 투자 대비 수익 — 월별 누적",
  tech: "cost × PRs merged × bugs fixed 시계열",
  usecase: "경영진 보고. 'AI 이 얼마 썼는데 얼마 벌었나' 수치화.",
  category: "ai",
  contexts: ["repo"],
  needs: { tree: true },
  order: 890,
  Component: AgentROIModeView,
};
