// Tool Profile view descriptor — per-file tool-use analytics.
// --------------------------------------------------------------------
// Reference: OpenAI Function Calling observability; Anthropic Claude
// Code telemetry; tool-use audit patterns (2024-2025).

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { ToolProfileView } from "./ui/ToolProfileView";

function ToolProfileModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
  const entity = ctx.selectedId ? ctx.tree.byId.get(ctx.selectedId) : null;
  if (!entity || (entity.kind !== "building" && entity.kind !== "floor")) {
    return <ToolProfileView ctx={ctx} empty />;
  }
  return <ToolProfileView ctx={ctx} entity={entity} />;
}

export const toolProfileViewDescriptor: ViewDescriptor = {
  id: "tool-profile",
  label: "Tools",
  glyph: "⚒",
  hint: "도구 사용 프로파일 — 파일별 tool 분포",
  tech: "AgentStep.toolName × 집계 (6 태스크 aggregated)",
  usecase: "에이전트가 이 파일에 어떤 tool 많이 쓰나. bash 비중 높으면 테스트 driven.",
  category: "ai",
  contexts: ["file"],
  needs: { tree: true, selection: true },
  order: 830,
  capabilityKinds: ["view", "decision-input"],
  taxonomy: {
    primary: {
      domain: "ai-agent",
      scope: "file",
      intent: "explain",
    },
    scopes: ["file", "task", "agent-run"],
    intents: ["explain", "diagnose", "optimize"],
    subdomain: "tool-observability",
    personas: ["developer", "ai-operator"],
    surfaces: ["view", "tab"],
    maturity: "advanced",
    signal: {
      dataFreshness: "snapshot",
      confidence: "measured",
      actionability: "triage",
      cost: "low",
      latency: "interactive",
      determinism: "deterministic",
      evidenceLevel: "strong",
      decisionGrade: "triage",
    },
    related: ["agent-trajectory", "turn-depth", "stuck-pattern"],
    keywords: ["tool", "profile", "bash", "read", "edit"],
  },
  decision: {
    grade: "triage",
    supports: ["approve-agent-run", "delegate"],
    evidenceClass: "strong",
    failClosedEligible: false,
    humanReviewRequired: true,
  },
  actions: ["open-tab", "run-analysis", "compare-related"],
  workflow: {
    usableInStacks: ["agent-failure-stack"],
    canBeAutoSuggested: true,
    canBeAutoAttached: false,
    requiresOrderedExecution: false,
  },
  quality: {
    maturity: "advanced",
    owner: "ai-platform",
  },
  Component: ToolProfileModeView,
};
