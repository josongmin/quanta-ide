// Arc (cycles) view descriptor — topological order + backward arcs.

import { useMemo, type ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { ArcView } from "./ui/ArcView";
import { buildArcLayout } from "./model/build-arc-layout";

function ArcModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  const layout = useMemo(() => {
    if (!ctx.tree || !ctx.graph) return null;
    if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
    try {
      return buildArcLayout({
        tree: ctx.tree,
        graph: ctx.graph,
        width: ctx.viewportSize.w,
        height: ctx.viewportSize.h,
        nodeKind: "galaxy",
      });
    } catch {
      return null;
    }
  }, [ctx.tree, ctx.graph, ctx.viewportSize.w, ctx.viewportSize.h]);

  if (!layout) return null;

  return (
    <ArcView
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

export const arcViewDescriptor: ViewDescriptor = {
  id: "arc-cycles",
  label: "Cycles",
  glyph: "⟳",
  hint: "역방향 엣지(순환 의존) 아크 다이어그램",
  tech: "Tarjan SCC — 강결합 컴포넌트",
  usecase:
    "순환 의존이 어디서 발생하는지 시각적으로 추적. SCC 내 파일 한 번에 확인. 순환 끊기 작업 전 영향도 파악.",
  category: "deps",
  contexts: ["repo", "folder"],
  needs: { tree: true, graph: true },
  order: 60,
  Component: ArcModeView,
};
