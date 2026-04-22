// TaskQueue view descriptor — repo-level agent task queue.
// Reference: Linear / Jira / GitHub Projects task patterns adapted for
// AI agents; Motion / Claude Code task queue surfaces.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { TaskQueueView } from "./ui/TaskQueueView";

function TaskQueueModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return <TaskQueueView ctx={ctx} />;
}

export const taskQueueViewDescriptor: ViewDescriptor = {
  id: "task-queue",
  label: "Queue",
  glyph: "☷",
  hint: "에이전트 태스크 큐",
  tech: "status × priority × task-kind 필터",
  usecase: "실행 대기 / 진행 중 / 리뷰 대기 태스크 한 화면. 우선순위 관리.",
  category: "ai",
  contexts: ["repo"],
  needs: { tree: true },
  order: 910,
  Component: TaskQueueModeView,
};
