// Readiness Score view descriptor — repo-wide agent-readiness composite.
// --------------------------------------------------------------------
// Reference: OpenAI GPTs readiness · Codeium AI-readiness score ·
// Anthropic "Preparing your codebase for Claude" 2024.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { ReadinessScoreView } from "./ui/ReadinessScoreView";

function ReadinessScoreModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
  return <ReadinessScoreView ctx={ctx} />;
}

export const readinessScoreViewDescriptor: ViewDescriptor = {
  id: "readiness-score",
  label: "Ready",
  glyph: "⚑",
  hint: "에이전트 투입 준비도",
  tech: "docs×tests×types×naming×commits×arch 6-factor composite",
  usecase: "AI 대시보드 핵심. 'AI 돌리기 전 뭘 먼저 손봐야?' 답.",
  category: "ai",
  contexts: ["repo"],
  needs: { tree: true },
  order: 860,
  Component: ReadinessScoreModeView,
};
