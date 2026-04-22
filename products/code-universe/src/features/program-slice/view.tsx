// ProgramSlice view descriptor — backward/forward program slicing.
// Reference: Weiser TSE 1981, "Program Slicing". CodeSurfer.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { ProgramSliceView } from "./ui/ProgramSliceView";

function ProgramSliceModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.graph) return null;
  return (
    <ProgramSliceView
      graph={ctx.graph}
      tree={ctx.tree}
      selectedId={ctx.selectedId}
      width={ctx.viewportSize.w}
      height={ctx.viewportSize.h}
      onFocusEntity={id => ctx.dispatch.selectEntity(id)}
    />
  );
}

export const programSliceViewDescriptor: ViewDescriptor = {
  id: "program-slice",
  label: "Slice",
  glyph: "⋔",
  hint: "프로그램 슬라이스 — 영향 역추적",
  tech: "데이터플로우 역/정방향 도달 분석",
  usecase: "버그 수정 시 '이 값 어디서 왔나/어디로 가나' 정확히.",
  category: "deps",
  contexts: ["file", "folder", "repo"],
  needs: { graph: true, selection: true },
  order: 120,
  Component: ProgramSliceModeView,
};
