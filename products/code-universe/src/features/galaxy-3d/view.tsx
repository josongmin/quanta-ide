// Galaxy 3D view descriptor — WebGL deep-space free-exploration.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { Galaxy3DView } from "./ui/Galaxy3DView";

function Galaxy3DModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.graph) return null;
  return (
    <Galaxy3DView
      graph={ctx.graph}
      selectedId={ctx.selectedId ?? undefined}
      onFocusEntity={id => {
        ctx.dispatch.selectEntity(id);
        ctx.dispatch.setMode("galaxy-3d");
      }}
      onDismiss={() => ctx.dispatch.selectEntity(null)}
    />
  );
}

export const galaxy3DViewDescriptor: ViewDescriptor = {
  id: "galaxy-3d",
  label: "Galaxy",
  glyph: "✹",
  hint: "3D 갤럭시 — 파일을 우주 공간에 배치",
  tech: "구조 유사도 임베딩 + 3D 포스 레이아웃",
  usecase:
    "전체 코드베이스를 우주처럼 자유 탐색(발견 모드). 데모/발표용 시각화. 구조 클러스터를 입체적으로 파악.",
  category: "explore",
  contexts: ["repo", "folder", "file"],
  needs: { graph: true },
  order: 220,
  Component: Galaxy3DModeView,
};
