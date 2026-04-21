// Co-change view descriptor — git-coupling heatmap.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { CoChangeView } from "./ui/CoChangeView";

function CoChangeModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.graph) return null;
  return (
    <CoChangeView
      graph={ctx.graph}
      onFocusEntity={id => {
        ctx.dispatch.selectEntity(id);
        ctx.dispatch.openMindMapOn(id);
        ctx.dispatch.setMode("mindmap");
      }}
      onDismiss={() => ctx.dispatch.selectEntity(null)}
    />
  );
}

export const coChangeViewDescriptor: ViewDescriptor = {
  id: "cochange",
  label: "CoChange",
  glyph: "⧉",
  hint: "함께 자주 바뀌는 파일 히트맵",
  tech: "git 커밋 co-occurrence 마이닝",
  usecase:
    "논리적으로 묶여야 할 파일들 발견 → 모듈화 후보. 변경 시 빠뜨린 파일 없는지 체크. 숨겨진 커플링(의존성 그래프에 안 보이는 것) 탐지.",
  category: "history",
  contexts: ["repo", "folder"],
  needs: { graph: true },
  order: 150,
  Component: CoChangeModeView,
};
