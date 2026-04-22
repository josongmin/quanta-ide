// TaskGraph view descriptor — DAG of task dependencies + critical path.
// Reference: CPM (Critical Path Method, Kelley 1961); DAG scheduling;
// bazel build graph.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { TaskGraphView } from "./ui/TaskGraphView";

function TaskGraphModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return <TaskGraphView ctx={ctx} />;
}

export const taskGraphViewDescriptor: ViewDescriptor = {
  id: "task-graph",
  label: "TaskGraph",
  glyph: "▣",
  hint: "태스크 의존성 그래프",
  tech: "task dep DAG × 위상정렬 × critical path",
  usecase: "어떤 태스크 먼저 끝내야 하나. 병목 의존 시각화.",
  category: "ai",
  contexts: ["repo"],
  needs: { tree: true },
  order: 940,
  Component: TaskGraphModeView,
};
