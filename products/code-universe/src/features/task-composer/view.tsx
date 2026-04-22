// TaskComposer view descriptor — NL → agent task wizard.
// Reference: Motion task-entry UX; Linear "Magic NL" pattern;
// Anthropic Claude Projects.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { TaskComposerView } from "./ui/TaskComposerView";

function TaskComposerModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return <TaskComposerView ctx={ctx} />;
}

export const taskComposerViewDescriptor: ViewDescriptor = {
  id: "task-composer",
  label: "Compose",
  glyph: "✎",
  hint: "태스크 작성기 — 자연어 → 에이전트 작업",
  tech: "NL → task-kind 분류 × 파일 추천 × 비용 프리뷰",
  usecase: "태스크 만드는 시간 단축. 컨텍스트 자동 추천.",
  category: "ai",
  contexts: ["repo"],
  needs: { tree: true },
  order: 930,
  Component: TaskComposerModeView,
};
