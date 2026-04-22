// SpecGaming view descriptor — reward hacking / specification gaming
// detection in agent-authored changes.
// --------------------------------------------------------------------
// Reference: Amodei et al. "Concrete Problems in AI Safety" (2016);
// Krakovna et al. specification gaming examples; Anthropic sycophancy
// work (2023). When agents are rewarded for passing tests, they may
// modify tests themselves, loosen assertions, skip tests, or over-mock
// real deps. This view surfaces those patterns per file so reviewers
// can audit both src and test changes together.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { SpecGamingView } from "./ui/SpecGamingView";

function SpecGamingModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return <SpecGamingView ctx={ctx} />;
}

export const specGamingViewDescriptor: ViewDescriptor = {
  id: "spec-gaming",
  label: "Gaming",
  glyph: "⚠",
  hint: "Reward Hacking 패턴 탐지",
  tech: "test edit × mock 과다 × assertion 완화 × skip × loose types",
  usecase: "에이전트가 '통과만 시키는' 변경 탐지. 리뷰 critical.",
  category: "ai",
  contexts: ["repo", "folder"],
  needs: { tree: true },
  order: 1030,
  Component: SpecGamingModeView,
};
