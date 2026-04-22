// ControlFlow view descriptor — per-function basic-block CFG.
// Reference: Allen CACM 1970, "Control Flow Analysis". Compilers
// textbook standard since.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { ControlFlowView } from "./ui/ControlFlowView";

function ControlFlowModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  return (
    <ControlFlowView
      tree={ctx.tree}
      selectedId={ctx.selectedId}
      width={ctx.viewportSize.w}
      height={ctx.viewportSize.h}
    />
  );
}

export const controlFlowViewDescriptor: ViewDescriptor = {
  id: "control-flow",
  label: "CFG",
  glyph: "⑂",
  hint: "함수 제어흐름 그래프",
  tech: "AST basic-block 분석",
  usecase: "복잡한 함수의 내부 구조 시각화. 리팩터 전 cognitive load 측정.",
  category: "deps",
  contexts: ["file", "folder", "repo"],
  order: 110,
  Component: ControlFlowModeView,
};
