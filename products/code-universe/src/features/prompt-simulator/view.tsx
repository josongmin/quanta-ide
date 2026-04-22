// Prompt Simulator view descriptor — per-task LLM cost simulator.
// --------------------------------------------------------------------
// Reference: Anthropic / OpenAI context engineering best practices
// 2025; "Prompt Budget" as novel framing of inference cost per task.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { PromptSimulatorView } from "./ui/PromptSimulatorView";

function PromptSimulatorModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
  const entity = ctx.selectedId ? ctx.tree.byId.get(ctx.selectedId) : null;
  if (!entity || (entity.kind !== "building" && entity.kind !== "floor")) {
    return <PromptSimulatorView ctx={ctx} empty />;
  }
  return <PromptSimulatorView ctx={ctx} entity={entity} />;
}

export const promptSimulatorViewDescriptor: ViewDescriptor = {
  id: "prompt-simulator",
  label: "Simulate",
  glyph: "⌨",
  hint: "프롬프트 시뮬레이터 — 태스크별 비용 예측",
  tech: "hop-depth × task-dependent output-ratio × 2026 pricing",
  usecase:
    "AI 에이전트 작업 돌리기 전 비용 가늠. 어떤 task가 얼마나 비싼지 실시간.",
  category: "ai",
  contexts: ["file"],
  needs: { tree: true, selection: true },
  order: 730,
  Component: PromptSimulatorModeView,
};
