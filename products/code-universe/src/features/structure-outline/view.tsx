// StructureOutline view descriptor — in-file symbol tree.
// --------------------------------------------------------------------
// References:
//   - JetBrains IntelliJ IDEA "Structure" tool window.
//   - Visual Studio Code "Outline" view.
//   - LSP DocumentSymbol (textDocument/documentSymbol) hierarchical spec.
// Applied here: pick a file, browse its class → method / variable nesting
// with expandable chevrons, visibility pills, LoC tags, declaration line.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { StructureOutlineView } from "./ui/StructureOutlineView";

function StructureOutlineModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  const selectedId = ctx.selectedId;
  const entity = selectedId ? ctx.tree.byId.get(selectedId) : null;
  if (!entity || (entity.kind !== "building" && entity.kind !== "floor" && entity.kind !== "room")) {
    return <StructureOutlineView ctx={ctx} empty />;
  }
  return <StructureOutlineView ctx={ctx} entity={entity} />;
}

export const structureOutlineViewDescriptor: ViewDescriptor = {
  id: "structure-outline",
  label: "Outline",
  glyph: "⋮",
  hint: "구조 아웃라인 — 파일 내 심볼 트리",
  tech: "LSP DocumentSymbol × AST",
  usecase: "파일 내부 구조 네비. 클래스 → 메소드 nested.",
  category: "explore",
  contexts: ["file"],
  needs: { tree: true, selection: true },
  order: 96,
  Component: StructureOutlineModeView,
};
