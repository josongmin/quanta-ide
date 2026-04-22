// Cognitive Complexity view descriptor — SonarQube/Campbell 2018 model.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { CognitiveComplexityView } from "./ui/CognitiveComplexityView";

function CognitiveComplexityModeView({
  ctx,
}: {
  ctx: ViewContextValue;
}): ReactElement | null {
  if (!ctx.tree) return null;
  if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
  return <CognitiveComplexityView ctx={ctx} />;
}

export const cognitiveComplexityViewDescriptor: ViewDescriptor = {
  id: "cognitive-complexity",
  label: "CogC",
  glyph: "⁀",
  hint: "인지 복잡도 — 읽기 어려운 파일",
  tech: "SonarQube Cognitive Complexity 모델 (중첩/재귀 가중치)",
  usecase:
    "cyclomatic이 놓치는 '읽기 힘든' 코드 식별. 리팩터 onboarding 용.",
  category: "metrics",
  contexts: ["repo", "folder"],
  needs: { tree: true },
  order: 250,
  Component: CognitiveComplexityModeView,
};
