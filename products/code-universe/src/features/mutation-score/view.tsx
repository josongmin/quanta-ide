// Mutation Score view — PIT / Stryker-style test-quality dashboard.
// Reference: PIT project "gold-standard test coverage"; Stryker.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { MutationScoreView } from "./ui/MutationScoreView";

function MutationScoreModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return <MutationScoreView ctx={ctx} />;
}

export const mutationScoreViewDescriptor: ViewDescriptor = {
  id: "mutation-score",
  label: "Mutation",
  glyph: "⚗",
  hint: "뮤테이션 테스트 — 테스트가 실제로 뭘 잡냐",
  tech: "PIT / Stryker mutation survival",
  usecase: "커버리지는 높은데 버그가 나오는 이유. '테스트 의미 있나' 검증.",
  category: "metrics",
  contexts: ["repo", "folder"],
  needs: { tree: true },
  order: 300,
  Component: MutationScoreModeView,
};
