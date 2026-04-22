// ConvergenceScore view descriptor — per-file agent convergence matrix.
// --------------------------------------------------------------------
// Reference: temperature / sampling determinism studies; Holtzman et al.
// "The Curious Case of Neural Text Degeneration" ICLR 2020 (nucleus
// sampling) adapted for code; Wang et al. "Self-Consistency Improves
// Chain of Thought Reasoning in Language Models" ICLR 2023. Answers:
// "does this agent converge to a single answer, or does it oscillate?"

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { ConvergenceScoreView } from "./ui/ConvergenceScoreView";

function ConvergenceScoreModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  const entity = ctx.selectedId ? ctx.tree.byId.get(ctx.selectedId) : null;
  if (!entity || (entity.kind !== "building" && entity.kind !== "floor")) {
    return <ConvergenceScoreView ctx={ctx} empty />;
  }
  return <ConvergenceScoreView ctx={ctx} entity={entity} />;
}

export const convergenceScoreViewDescriptor: ViewDescriptor = {
  id: "convergence-score",
  label: "Converge",
  glyph: "◉",
  hint: "에이전트 수렴성 — 같은 태스크 반복 결과 일관성",
  tech: "성공률 × 솔루션 다양성 composite",
  usecase: "자동화 후보 선별. 수렴 낮으면 사람 개입 필요.",
  category: "ai",
  contexts: ["file"],
  needs: { tree: true, selection: true },
  order: 900,
  Component: ConvergenceScoreModeView,
};
