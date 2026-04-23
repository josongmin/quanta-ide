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
  capabilityKinds: ["view", "decision-input", "workflow-step"],
  taxonomy: {
    primary: {
      domain: "ai-context-model",
      scope: "model",
      intent: "explain",
    },
    scopes: ["file", "task", "model", "budget"],
    intents: ["decide", "optimize", "explain"],
    subdomain: "cost-simulation",
    personas: ["developer", "manager", "ai-operator"],
    surfaces: ["view", "tab", "command"],
    maturity: "advanced",
    signal: {
      dataFreshness: "snapshot",
      confidence: "estimated",
      actionability: "direct-action",
      cost: "medium",
      latency: "interactive",
      determinism: "deterministic",
      evidenceLevel: "strong",
      decisionGrade: "advisory",
    },
    related: ["token-economy", "model-router", "model-swap-sim"],
    keywords: ["prompt", "simulate", "budget", "cost", "task"],
  },
  decision: {
    grade: "advisory",
    supports: ["route-model", "delegate"],
    evidenceClass: "strong",
    failClosedEligible: false,
    humanReviewRequired: false,
  },
  actions: ["open-tab", "run-analysis", "attach-to-task-routing", "compare-related"],
  workflow: {
    usableInStacks: ["context-engineering-stack", "agent-delegation-stack"],
    canBeAutoSuggested: true,
    canBeAutoAttached: true,
    requiresOrderedExecution: false,
  },
  quality: {
    maturity: "advanced",
    owner: "ai-platform",
  },
  Component: PromptSimulatorModeView,
};
