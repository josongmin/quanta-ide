// Agent Trajectory view descriptor — Langsmith / Traceloop style trace.
// --------------------------------------------------------------------
// Reference: Langsmith · Traceloop · Braintrust 2024-2025;
// OpenTelemetry AI semantic conventions.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { AgentTrajectoryView } from "./ui/AgentTrajectoryView";

function AgentTrajectoryModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
  const entity = ctx.selectedId ? ctx.tree.byId.get(ctx.selectedId) : null;
  if (!entity || (entity.kind !== "building" && entity.kind !== "floor")) {
    return <AgentTrajectoryView ctx={ctx} empty />;
  }
  return <AgentTrajectoryView ctx={ctx} entity={entity} />;
}

export const agentTrajectoryViewDescriptor: ViewDescriptor = {
  id: "agent-trajectory",
  label: "Trace",
  glyph: "⇢",
  hint: "에이전트 실행 트레이스 — step-by-step",
  tech: "Langsmith/Traceloop 스타일 agent trace",
  usecase: "에이전트가 뭘 했는지 재구성. 실패 스텝 디버깅.",
  category: "ai",
  contexts: ["file"],
  needs: { tree: true, selection: true },
  order: 820,
  Component: AgentTrajectoryModeView,
};
