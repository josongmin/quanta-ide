// ChangeImpact view descriptor — transitive dependent closure.
// Reference: Bohner & Arnold, "Software Change Impact Analysis",
// IEEE CS Press 1996.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { ChangeImpactView } from "./ui/ChangeImpactView";

function ChangeImpactModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.graph) return null;
  return (
    <ChangeImpactView
      graph={ctx.graph}
      tree={ctx.tree}
      selectedId={ctx.selectedId}
      width={ctx.viewportSize.w}
      height={ctx.viewportSize.h}
      onFocusEntity={id => ctx.dispatch.selectEntity(id)}
    />
  );
}

export const changeImpactViewDescriptor: ViewDescriptor = {
  id: "change-impact",
  label: "Impact",
  glyph: "⟳",
  hint: "변경 영향 — 전이적 도달 집합",
  tech: "BFS over 의존성 그래프",
  usecase: "리팩터링 전 '이 파일 바꾸면 몇 개 파일 영향?' 정확한 closure.",
  category: "deps",
  contexts: ["file", "folder", "repo"],
  needs: { graph: true, selection: true },
  order: 130,
  Component: ChangeImpactModeView,
};
