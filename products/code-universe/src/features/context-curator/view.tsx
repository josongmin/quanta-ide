// ContextCurator view descriptor.
// --------------------------------------------------------------------
// User-controlled context management. File tree with pin/exclude
// toggles × current-context token meter × saved-slice picker.
//
// Reference: Anthropic Claude Projects context UI;
// Cursor Codebase Index; Continue.dev context providers.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { ContextCuratorView } from "./ui/ContextCuratorView";

function ContextCuratorModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
  return <ContextCuratorView ctx={ctx} />;
}

export const contextCuratorViewDescriptor: ViewDescriptor = {
  id: "context-curator",
  label: "Curate",
  glyph: "◫",
  hint: "컨텍스트 큐레이터 — 수동 pin/exclude",
  tech: "파일별 상태 토글 × 슬라이스 로드 × 토큰 예산",
  usecase: "에이전트가 볼 파일 수동 통제. 노이즈 제거. 비용 최적화.",
  category: "ai",
  contexts: ["repo"],
  needs: { tree: true },
  order: 960,
  capabilityKinds: ["view", "decision-input", "workflow-step"],
  taxonomy: {
    primary: {
      domain: "ai-context-model",
      scope: "task",
      intent: "optimize",
    },
    scopes: ["file", "task", "budget", "model"],
    intents: ["optimize", "decide", "explain"],
    subdomain: "context-selection",
    personas: ["developer", "ai-operator"],
    surfaces: ["view", "tab", "command"],
    maturity: "core",
    signal: {
      dataFreshness: "snapshot",
      confidence: "measured",
      actionability: "direct-action",
      cost: "medium",
      latency: "interactive",
      determinism: "deterministic",
      evidenceLevel: "strong",
      decisionGrade: "advisory",
    },
    related: ["context-waste", "context-shape", "memory-vault"],
    keywords: ["context", "curator", "slice", "budget", "pin"],
  },
  decision: {
    grade: "advisory",
    supports: ["route-model", "delegate"],
    evidenceClass: "strong",
    failClosedEligible: false,
    humanReviewRequired: false,
  },
  actions: ["open-tab", "run-analysis", "attach-to-agent-plan", "attach-to-task-routing"],
  workflow: {
    usableInStacks: ["context-engineering-stack", "agent-delegation-stack"],
    canBeAutoSuggested: true,
    canBeAutoAttached: true,
    requiresOrderedExecution: false,
  },
  quality: {
    maturity: "core",
    owner: "ai-platform",
  },
  Component: ContextCuratorModeView,
};
