// TaskKanban view descriptor — 4-column agent task board + WIP guard.
// Reference: Kanban method (David J. Anderson 2010); Linear board;
// Claude Code agent board.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { TaskKanbanView } from "./ui/TaskKanbanView";

function TaskKanbanModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return <TaskKanbanView ctx={ctx} />;
}

export const taskKanbanViewDescriptor: ViewDescriptor = {
  id: "task-kanban",
  label: "Kanban",
  glyph: "⬚",
  hint: "에이전트 태스크 칸반",
  tech: "4-column + WIP limit",
  usecase: "상태별 태스크 흐름. 병목 지점 가시화.",
  category: "ai",
  contexts: ["repo"],
  needs: { tree: true },
  order: 920,
  Component: TaskKanbanModeView,
};
