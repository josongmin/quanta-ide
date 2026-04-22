// Refactor terrain view descriptor — ROI-ranked refactor candidates.

import { useMemo, type ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { RefactorTerrainView } from "./ui/RefactorTerrainView";
import { buildRefactorTerrainLayout } from "./model/build-refactor-terrain-layout";

function RefactorTerrainModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  const layout = useMemo(() => {
    if (!ctx.tree || !ctx.graph) return null;
    if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
    try {
      return buildRefactorTerrainLayout({ tree: ctx.tree, graph: ctx.graph });
    } catch {
      return null;
    }
  }, [ctx.tree, ctx.graph, ctx.viewportSize.w, ctx.viewportSize.h]);

  if (!layout) return null;

  return (
    <RefactorTerrainView
      layout={layout}
      width={ctx.viewportSize.w}
      height={ctx.viewportSize.h}
      onFocusEntity={id => {
        ctx.dispatch.selectEntity(id);
        ctx.dispatch.openMindMapOn(id);
        ctx.dispatch.setMode("mindmap");
      }}
      onDismiss={() => ctx.dispatch.selectEntity(null)}
    />
  );
}

export const refactorTerrainViewDescriptor: ViewDescriptor = {
  id: "refactor-terrain",
  label: "Refactor",
  glyph: "△",
  hint: "ROI 순위 기반 리팩터링 목록",
  tech: "복잡도 × churn ROI 스코어링",
  usecase:
    "리팩터링 우선순위를 ROI 기준으로 정량화. 스프린트에 리팩터링 티켓 넣을 때 근거 자료. '감으로 고르기' 대신 데이터 기반 결정.",
  category: "refactor",
  contexts: ["repo", "folder"],
  needs: { tree: true, graph: true },
  order: 460,
  Component: RefactorTerrainModeView,
};
