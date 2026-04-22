// Code City 3D view descriptor — SVG isometric "city" metaphor.
//
// Reference: Wettel & Lanza.
// "Visualizing Software Systems as Cities", VISSOFT 2007 + TSE 2011.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { CodeCity3DView } from "./ui/CodeCity3DView";

function CodeCity3DModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
  return (
    <CodeCity3DView
      tree={ctx.tree}
      width={ctx.viewportSize.w}
      height={ctx.viewportSize.h}
      selectedId={ctx.selectedId}
      onFocusEntity={id => ctx.dispatch.selectEntity(id)}
    />
  );
}

export const codeCity3DViewDescriptor: ViewDescriptor = {
  id: "code-city-3d",
  label: "City",
  glyph: "⌬",
  hint: "CodeCity 3D — 파일을 건물로",
  tech: "Wettel/Lanza VISSOFT 2007 클래식",
  usecase: "구조 overview. 팀 시연/포트폴리오용 시각 임팩트 큼.",
  category: "explore",
  contexts: ["repo", "folder"],
  needs: { tree: true },
  order: 10,
  Component: CodeCity3DModeView,
};
