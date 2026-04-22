// InnerCity view descriptor — file-scope "small city".
// --------------------------------------------------------------------
// Reference: Wettel & Lanza, "CodeCity — 3D Visualization of
// Large-Scale Software" (VISSOFT 2007) — applied here at file-scope
// rather than repo-scope: a single file becomes the city, its
// top-level symbols the buildings, its commits the street-level
// activity strip. The compression from "repo city" to "file city"
// keeps the core metaphor (box-footprint = size, box-height =
// complexity) but makes it readable without 3D.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { InnerCityView } from "./ui/InnerCityView";

function InnerCityModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  const selectedId = ctx.selectedId;
  const entity = selectedId ? ctx.tree.byId.get(selectedId) : null;
  if (!entity || (entity.kind !== "building" && entity.kind !== "floor" && entity.kind !== "room")) {
    return <InnerCityView ctx={ctx} empty />;
  }
  return <InnerCityView ctx={ctx} entity={entity} />;
}

export const innerCityViewDescriptor: ViewDescriptor = {
  id: "inner-city",
  label: "InnerCity",
  glyph: "⌬",
  hint: "파일 내부 시티 — 심볼 × 의존성 × 커밋",
  tech: "AST 심볼 블록 × 의존성 × git log",
  usecase: "한 파일의 건강 상태 한 화면. 리팩터 전 내부 구조 파악.",
  category: "explore",
  contexts: ["file"],
  needs: { tree: true, selection: true },
  order: 90,
  Component: InnerCityModeView,
};
