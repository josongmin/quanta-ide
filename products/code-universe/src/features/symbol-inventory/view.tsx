// SymbolInventory view descriptor — flat-grid symbol manifest.
// --------------------------------------------------------------------
// References:
//   - Sourcetrail — interactive symbol view (one row per symbol, kind
//     icon, visibility pill, usage counts).
//   - SciTools Understand — "Entity Filter" (sort / filter arbitrary
//     symbols in a file without leaving the tree).
// Applied here as a file-scope flat list: pick a file, see every
// class / function / method / variable / interface declared inside it,
// sortable by the metric you care about.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { SymbolInventoryView } from "./ui/SymbolInventoryView";

function SymbolInventoryModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  const selectedId = ctx.selectedId;
  const entity = selectedId ? ctx.tree.byId.get(selectedId) : null;
  if (!entity || (entity.kind !== "building" && entity.kind !== "floor" && entity.kind !== "room")) {
    return <SymbolInventoryView ctx={ctx} empty />;
  }
  return <SymbolInventoryView ctx={ctx} entity={entity} />;
}

export const symbolInventoryViewDescriptor: ViewDescriptor = {
  id: "symbol-inventory",
  label: "Symbols",
  glyph: "⊞",
  hint: "심볼 인벤토리 — 파일 내 class/function/var",
  tech: "AST symbol extraction × per-symbol metrics",
  usecase: "이 파일에 뭐가 들어있나 스캔. visibility/복잡도 정렬.",
  category: "explore",
  contexts: ["file"],
  needs: { tree: true, selection: true },
  order: 95,
  Component: SymbolInventoryModeView,
};
