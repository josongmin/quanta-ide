// Voronoi Treemap view descriptor — centroidal Voronoi partition.
//
// Reference: Balzer & Deussen. "Voronoi Treemaps", IEEE InfoVis 2005.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { VoronoiTreemapView } from "./ui/VoronoiTreemapView";

function VoronoiTreemapModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
  return (
    <VoronoiTreemapView
      tree={ctx.tree}
      width={ctx.viewportSize.w}
      height={ctx.viewportSize.h}
      selectedId={ctx.selectedId}
      onFocusEntity={id => ctx.dispatch.selectEntity(id)}
    />
  );
}

export const voronoiTreemapViewDescriptor: ViewDescriptor = {
  id: "voronoi-treemap",
  label: "Voronoi",
  glyph: "◈",
  hint: "Voronoi Treemap — 유기적 세포형 계층 시각화",
  tech: "Balzer & Deussen InfoVis 2005 centroidal Voronoi",
  usecase: "직각 treemap 대안. 과학 포스터급 시각. 패키지 크기 유기적 인지.",
  category: "explore",
  contexts: ["repo", "folder"],
  needs: { tree: true },
  order: 30,
  Component: VoronoiTreemapModeView,
};
