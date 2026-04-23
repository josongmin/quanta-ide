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
  capabilityKinds: ["view", "workflow-step", "policy-control"],
  taxonomy: {
    primary: {
      domain: "productivity",
      scope: "task",
      intent: "govern",
    },
    scopes: ["team", "repo", "task"],
    intents: ["govern", "optimize", "decide"],
    subdomain: "flow-ops",
    personas: ["manager", "tech-lead"],
    surfaces: ["view", "tab", "dashboard-card"],
    maturity: "advanced",
    signal: {
      dataFreshness: "snapshot",
      confidence: "measured",
      actionability: "direct-action",
      cost: "low",
      latency: "interactive",
      determinism: "deterministic",
      evidenceLevel: "strong",
      decisionGrade: "triage",
    },
    related: ["task-queue", "review-burden", "task-graph"],
    keywords: ["kanban", "wip", "blocked", "flow"],
  },
  decision: {
    grade: "triage",
    supports: ["policy-audit", "escalate-review"],
    evidenceClass: "strong",
    failClosedEligible: false,
    humanReviewRequired: false,
  },
  actions: ["open-tab", "pin-dashboard", "attach-to-policy-check"],
  workflow: {
    canBeAutoSuggested: true,
    canBeAutoAttached: false,
    requiresOrderedExecution: false,
  },
  quality: {
    maturity: "advanced",
    owner: "platform",
  },
  Component: TaskKanbanModeView,
};
