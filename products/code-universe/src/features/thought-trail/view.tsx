// ThoughtTrail view descriptor — commit-sequence bubble flow.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { ThoughtTrailView } from "./ui/ThoughtTrailView";

function ThoughtTrailModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return (
    <ThoughtTrailView
      tree={ctx.tree}
      onFocusEntity={id => ctx.dispatch.selectEntity(id)}
    />
  );
}

export const thoughtTrailViewDescriptor: ViewDescriptor = {
  id: "thought-trail",
  label: "Trail",
  glyph: "⋯",
  hint: "커밋 사고의 궤적",
  tech: "commit message 임베딩 × 파일 변경",
  usecase: "'이 브랜치가 뭘 풀려고 했나' 회고. PR 설명 자동화 재료.",
  category: "history",
  contexts: ["repo", "folder"],
  needs: { tree: true },
  order: 750,
  Component: ThoughtTrailModeView,
};
