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
  capabilityKinds: ["view", "workflow-step", "policy-control"],
  taxonomy: {
    primary: {
      domain: "productivity",
      scope: "task",
      intent: "decide",
    },
    scopes: ["repo", "task", "team"],
    intents: ["decide", "optimize", "govern"],
    subdomain: "task-operations",
    personas: ["manager", "developer", "tech-lead"],
    surfaces: ["view", "tab", "dashboard-card"],
    maturity: "core",
    signal: {
      dataFreshness: "snapshot",
      confidence: "measured",
      actionability: "direct-action",
      cost: "low",
      latency: "interactive",
      determinism: "deterministic",
      evidenceLevel: "strong",
      decisionGrade: "advisory",
    },
    related: ["task-kanban", "task-composer", "task-graph"],
    keywords: ["task", "queue", "priority", "deps", "linear"],
  },
  decision: {
    grade: "advisory",
    supports: ["delegate", "policy-audit"],
    evidenceClass: "strong",
    failClosedEligible: false,
    humanReviewRequired: false,
  },
  actions: ["open-tab", "pin-dashboard", "attach-to-task-routing"],
  workflow: {
    usableInStacks: ["agent-delegation-stack"],
    canBeAutoSuggested: true,
    canBeAutoAttached: true,
    requiresOrderedExecution: false,
  },
  quality: {
    maturity: "core",
    owner: "platform",
  },
  Component: TaskQueueModeView,
};
