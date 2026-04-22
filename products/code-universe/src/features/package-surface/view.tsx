// PackageSurface view descriptor — package-scoped treemap heatmap.
// --------------------------------------------------------------------
// References:
//   - Shneiderman, "Tree Visualization with Tree-Maps", ACM InfoVis 1991.
//   - Johnson & Shneiderman, SequoiaView (1999).

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { PackageSurfaceView } from "./ui/PackageSurfaceView";

function PackageSurfaceModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
  const selectedId = ctx.selectedId;
  const entity = selectedId ? ctx.tree.byId.get(selectedId) : null;
  if (
    !entity ||
    (entity.kind !== "street" &&
      entity.kind !== "galaxy" &&
      entity.kind !== "universe")
  ) {
    return <PackageSurfaceView ctx={ctx} empty />;
  }
  return <PackageSurfaceView ctx={ctx} entity={entity} />;
}

export const packageSurfaceViewDescriptor: ViewDescriptor = {
  id: "package-surface",
  label: "PkgSurface",
  glyph: "⊠",
  hint: "패키지 내부 treemap — 파일별 위험도",
  tech: "squarified treemap × bugProbability 히트",
  usecase: "패키지 선택 후 가장 위험한 파일 즉시 스캔.",
  category: "explore",
  contexts: ["folder"],
  needs: { tree: true, selection: true },
  order: 92,
  Component: PackageSurfaceModeView,
};
