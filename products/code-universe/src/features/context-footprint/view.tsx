// ContextFootprint view descriptor — transitive import cost per file.
// --------------------------------------------------------------------
// Reference: Anthropic context-window docs (2025); OpenAI Prompt
// engineering guide. Transitive import blast is the #1 source of
// context bloat in IDE coding agents — this view makes it legible
// hop-by-hop and prices it across 5 frontier models.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { ContextFootprintView } from "./ui/ContextFootprintView";

function ContextFootprintModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  const entity = ctx.selectedId ? ctx.tree.byId.get(ctx.selectedId) : null;
  if (!entity || (entity.kind !== "building" && entity.kind !== "floor")) {
    return <ContextFootprintView ctx={ctx} empty />;
  }
  return <ContextFootprintView ctx={ctx} entity={entity} />;
}

export const contextFootprintViewDescriptor: ViewDescriptor = {
  id: "context-footprint",
  label: "Context",
  glyph: "◉",
  hint: "컨텍스트 footprint — transitive import 비용",
  tech: "BFS import graph × tiktoken 추정",
  usecase: "이 파일 하나 AI가 이해하려면 몇 토큰 필요한가. 인터페이스만으로 줄이면? 비용 최소화.",
  category: "ai",
  contexts: ["file"],
  needs: { tree: true, selection: true },
  order: 710,
  capabilityKinds: ["view", "decision-input", "workflow-step"],
  taxonomy: {
    primary: {
      domain: "ai-context-model",
      scope: "file",
      intent: "explain",
    },
    scopes: ["file", "module", "task"],
    intents: ["explain", "optimize", "decide"],
    subdomain: "transitive-context",
    personas: ["developer", "tech-lead", "ai-operator"],
    surfaces: ["view", "tab", "command"],
    maturity: "advanced",
    signal: {
      dataFreshness: "snapshot",
      confidence: "estimated",
      actionability: "triage",
      cost: "low",
      latency: "interactive",
      determinism: "bounded",
      evidenceLevel: "strong",
      decisionGrade: "advisory",
    },
    related: ["context-waste", "context-window-fit", "context-shape"],
    keywords: ["context", "footprint", "import", "token", "blast"],
  },
  decision: {
    grade: "advisory",
    supports: ["delegate", "route-model"],
    evidenceClass: "strong",
    failClosedEligible: false,
    humanReviewRequired: true,
  },
  actions: ["open-tab", "run-analysis", "attach-to-agent-plan", "compare-related"],
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
  Component: ContextFootprintModeView,
};
