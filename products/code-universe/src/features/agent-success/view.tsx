// AgentSuccess view descriptor — autonomous-agent success probability
// heatmap × task.
// --------------------------------------------------------------------
// Reference: Jimenez et al. "SWE-bench", ICLR 2024; METR "Measuring AI
// Ability to Complete Long Tasks" (2024). Composite probability from
// coverage × size × complexity × AI-friendliness with a task-difficulty
// multiplier. Novel 2026 framing — "which files should you delegate to
// an autonomous agent, which need human review?"

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { AgentSuccessView } from "./ui/AgentSuccessView";

function AgentSuccessModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return <AgentSuccessView ctx={ctx} />;
}

export const agentSuccessViewDescriptor: ViewDescriptor = {
  id: "agent-success",
  label: "Agent",
  glyph: "◐",
  hint: "에이전트 성공 확률 — 태스크 × 파일",
  tech: "coverage × size × complexity × friendliness composite",
  usecase: "AI 에이전트에 맡겨도 되는 파일 vs 사람 개입 필요 파일 구분.",
  category: "ai",
  contexts: ["repo", "folder"],
  needs: { tree: true },
  order: 770,
  Component: AgentSuccessModeView,
};
