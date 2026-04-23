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
  capabilityKinds: ["view", "decision-input", "workflow-step"],
  taxonomy: {
    primary: {
      domain: "ai-agent",
      scope: "task",
      intent: "decide",
    },
    scopes: ["task", "file", "model", "budget"],
    intents: ["decide", "optimize", "explain"],
    subdomain: "task-routing",
    personas: ["developer", "ai-operator"],
    surfaces: ["view", "tab", "command"],
    maturity: "core",
    signal: {
      dataFreshness: "snapshot",
      confidence: "estimated",
      actionability: "direct-action",
      cost: "medium",
      latency: "interactive",
      determinism: "bounded",
      evidenceLevel: "strong",
      decisionGrade: "advisory",
    },
    related: ["task-queue", "model-router", "agentability"],
    keywords: ["task", "composer", "routing", "prompt", "cheapest"],
  },
  decision: {
    grade: "advisory",
    supports: ["delegate", "route-model"],
    evidenceClass: "strong",
    failClosedEligible: false,
    humanReviewRequired: false,
  },
  actions: ["open-tab", "run-analysis", "attach-to-task-routing", "attach-to-agent-plan"],
  workflow: {
    usableInStacks: ["agent-delegation-stack", "context-engineering-stack"],
    canBeAutoSuggested: true,
    canBeAutoAttached: true,
    requiresOrderedExecution: false,
  },
  quality: {
    maturity: "core",
    owner: "ai-platform",
  },
  Component: TaskComposerModeView,
};
