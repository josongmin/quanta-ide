// Author territory view descriptor — blame-based ownership map.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { AuthorTerritoryView } from "./ui/AuthorTerritoryView";

function AuthorTerritoryModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.graph) return null;
  return (
    <AuthorTerritoryView
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

export const authorTerritoryViewDescriptor: ViewDescriptor = {
  id: "author-territory",
  label: "Authors",
  glyph: "◐",
  hint: "blame 기반 작성자 소유 영역",
  tech: "git blame 소유권 분석",
  usecase:
    "PR 리뷰어 지정 시 누가 이 영역 담당인지 확인. 온보딩 시 도메인별 담당자 파악. 버스 팩터(한 명만 아는 영역) 위험 식별.",
  category: "team",
  contexts: ["repo"],
  needs: { graph: true },
  order: 600,
  Component: AuthorTerritoryModeView,
};
