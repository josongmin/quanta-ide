// SymbolFan — descriptor for the egocentric caller/callee fan.
// --------------------------------------------------------------------
// Reference: Understand "Butterfly" view; Doxygen caller / called-by
// graphs. The focused symbol sits at the center; callers fan out to
// the left, callees to the right. Edges are tapered beziers whose
// width ∝ call frequency. Recursion renders as a small circular arrow
// above the center node.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { SymbolFanView } from "./ui/SymbolFanView";

function SymbolFanModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return <SymbolFanView ctx={ctx} />;
}

export const symbolFanViewDescriptor: ViewDescriptor = {
  id: "symbol-fan",
  label: "SymFan",
  glyph: "⋈",
  hint: "심볼 부채꼴 — caller × callee",
  tech: "ego call graph × 부채꼴 layout",
  usecase: "이 함수 누가 부르고 누가 불리나 즉시 파악. 리팩터 전 체크.",
  category: "deps",
  contexts: ["file"],
  needs: { tree: true, selection: true },
  order: 210,
  Component: SymbolFanModeView,
};
