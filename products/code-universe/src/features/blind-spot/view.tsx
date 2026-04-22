// BlindSpot view descriptor — regions where model "doesn't know what
// it doesn't know" (proprietary APIs, novel libs, internal DSLs, domain).
// --------------------------------------------------------------------
// Reference: Kadavath et al. "Language Models (Mostly) Know What They
// Know" (2022); Liu et al. FSE 2024 hallucination taxonomy; novel OOD
// detection applied to code. High-blind-spot files are prime candidates
// for confabulation — pre-emptive human review lowers deployment risk.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { BlindSpotView } from "./ui/BlindSpotView";

function BlindSpotModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return <BlindSpotView ctx={ctx} />;
}

export const blindSpotViewDescriptor: ViewDescriptor = {
  id: "blind-spot",
  label: "Blind",
  glyph: "○",
  hint: "모델이 모르는 걸 모르는 지역",
  tech: "독점 API × 신규 lib × 내부 DSL × 도메인 특수성 composite",
  usecase: "에이전트가 confabulate할 지역 선제 식별. 리뷰 우선순위.",
  category: "ai",
  contexts: ["repo", "folder"],
  needs: { tree: true },
  order: 1020,
  Component: BlindSpotModeView,
};
