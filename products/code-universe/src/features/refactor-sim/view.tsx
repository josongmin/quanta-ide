// Refactor simulation view descriptor — what-if impact of a move.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { RefactorSimView } from "./ui/RefactorSimView";

function RefactorSimModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.graph) return null;
  return (
    <RefactorSimView
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

export const refactorSimViewDescriptor: ViewDescriptor = {
  id: "refactor-sim",
  label: "Simulate",
  glyph: "⊕",
  hint: "리팩터링 시뮬레이션 — 예상 효과",
  tech: "의존성 그래프 변이 시뮬레이션",
  usecase:
    "실제 코드 건드리기 전 '이걸 분리하면 의존성이 어떻게 바뀌나' 확인. 팀에 리팩터링 제안할 때 before/after 근거 자료. 리스크 없는 사전 검증.",
  category: "plan",
  contexts: ["repo", "folder", "file"],
  needs: { graph: true },
  order: 160,
  Component: RefactorSimModeView,
};
