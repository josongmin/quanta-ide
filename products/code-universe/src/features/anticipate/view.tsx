// Anticipate view descriptor — agent's preemptive next-action predictions.
// --------------------------------------------------------------------
// Reference:
//   - Google "Ambient Agents" (2025) — background anticipatory compute
//   - Leviathan et al. "Fast Inference via Speculative Decoding" (ICML 2023) — adapted for UI
//   - Anticipatory computing research (2024-2025)
//
// Shows, for the selected file, what actions the agent has already begun
// speculatively in the background: triggers, predicted action labels,
// confidence, estimated cost, and latency that would be saved if the user
// accepts the prepared action.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { AnticipateView } from "./ui/AnticipateView";

function AnticipateModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  const entity = ctx.selectedId ? ctx.tree.byId.get(ctx.selectedId) : null;
  if (!entity || (entity.kind !== "building" && entity.kind !== "floor")) {
    return <AnticipateView ctx={ctx} empty />;
  }
  return <AnticipateView ctx={ctx} entity={entity} />;
}

export const anticipateViewDescriptor: ViewDescriptor = {
  id: "anticipate",
  label: "Anticip",
  glyph: "▶",
  hint: "선제 예측 액션 — 다음에 뭐 할지",
  tech: "trigger detection × speculative compute × confidence",
  usecase: "agent가 미리 준비한 액션 체감 latency 감소. 'just-in-time' 에이전트.",
  category: "ai",
  contexts: ["file"],
  needs: { tree: true, selection: true },
  order: 1170,
  capabilityKinds: ["view", "decision-input", "workflow-step"],
  taxonomy: {
    primary: {
      domain: "ai-agent",
      scope: "agent-run",
      intent: "optimize",
    },
    scopes: ["file", "task", "agent-run"],
    intents: ["decide", "optimize", "diagnose"],
    subdomain: "anticipatory-actions",
    personas: ["developer", "ai-operator"],
    surfaces: ["view", "tab", "command"],
    maturity: "experimental",
    signal: {
      dataFreshness: "snapshot",
      confidence: "estimated",
      actionability: "triage",
      cost: "medium",
      latency: "interactive",
      determinism: "bounded",
      evidenceLevel: "weak",
      decisionGrade: "advisory",
    },
    related: ["counterfactual", "agent-orchestra", "task-composer"],
    keywords: ["anticipate", "speculative", "next", "latency", "trigger"],
  },
  decision: {
    grade: "advisory",
    supports: ["approve-agent-run", "delegate"],
    evidenceClass: "weak",
    failClosedEligible: false,
    humanReviewRequired: true,
  },
  actions: ["open-tab", "run-analysis", "attach-to-agent-plan"],
  workflow: {
    usableInStacks: ["agent-delegation-stack", "agent-failure-stack"],
    canBeAutoSuggested: true,
    canBeAutoAttached: false,
    requiresOrderedExecution: false,
  },
  quality: {
    maturity: "experimental",
    owner: "research",
  },
  Component: AnticipateModeView,
};
