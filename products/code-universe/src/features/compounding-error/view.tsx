// CompoundingError view descriptor — agent chain-length × per-step accuracy.
// --------------------------------------------------------------------
// Reference: Jimenez et al. "SWE-bench" ICLR 2024; METR "Measuring AI
// Ability to Complete Long Tasks" (2024). "Compounding error" is a known
// 2026 agent limitation: end-to-end success decays as p^k where p is
// per-step accuracy and k is chain length. Visualising the decay curve
// plus observed per-task chain lengths makes the limit concrete for
// deployment decisions.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { CompoundingErrorView } from "./ui/CompoundingErrorView";

function CompoundingErrorModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return <CompoundingErrorView ctx={ctx} />;
}

export const compoundingErrorViewDescriptor: ViewDescriptor = {
  id: "compounding-error",
  label: "Compound",
  glyph: "∿",
  hint: "체인 길어질수록 무너짐 — per-step × chain length",
  tech: "p^k 합성 정확도 곡선 × 태스크별 관찰된 chain length",
  usecase: "왜 에이전트가 복잡한 태스크에서 망가지나. chain 줄이기 / per-step 높이기 결정.",
  category: "ai",
  contexts: ["repo"],
  needs: { tree: true },
  order: 1010,
  Component: CompoundingErrorModeView,
};
