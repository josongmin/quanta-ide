// Blast Radius (Agent) view descriptor — intended vs actual scope audit.
// --------------------------------------------------------------------
// Reference: Anthropic Computer Use guardrails; OWASP LLM06:2025
// (Excessive Agency); NIST AI RMF — scope-containment metrics.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { BlastRadiusAgentView } from "./ui/BlastRadiusAgentView";

function BlastRadiusAgentModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
  const entity = ctx.selectedId ? ctx.tree.byId.get(ctx.selectedId) : null;
  if (!entity || (entity.kind !== "building" && entity.kind !== "floor")) {
    return <BlastRadiusAgentView ctx={ctx} empty />;
  }
  return <BlastRadiusAgentView ctx={ctx} entity={entity} />;
}

export const blastRadiusAgentViewDescriptor: ViewDescriptor = {
  id: "blast-radius-agent",
  label: "Scope",
  glyph: "◯",
  hint: "에이전트 scope 위반 — 의도 vs 실제",
  tech: "intended file set × actual edit set diff",
  usecase: "에이전트가 지시 범위 벗어났나 감사. 안전성 지표.",
  category: "ai",
  contexts: ["file"],
  needs: { tree: true, selection: true },
  order: 850,
  capabilityKinds: ["view", "decision-input", "gate-check", "policy-control"],
  taxonomy: {
    primary: {
      domain: "ai-trust-governance",
      scope: "task",
      intent: "verify",
    },
    scopes: ["file", "diff", "task", "policy"],
    intents: ["verify", "govern", "decide"],
    subdomain: "scope-containment",
    personas: ["security", "reviewer", "ai-operator"],
    surfaces: ["view", "tab", "diff-inline"],
    maturity: "advanced",
    signal: {
      dataFreshness: "snapshot",
      confidence: "measured",
      actionability: "direct-action",
      cost: "medium",
      latency: "interactive",
      determinism: "deterministic",
      evidenceLevel: "strong",
      decisionGrade: "gating",
    },
    related: ["prompt-injection", "diff-evidence", "audit-trail"],
    keywords: ["blast", "radius", "scope", "agency", "violation"],
  },
  decision: {
    grade: "gating",
    supports: ["merge", "delegate", "policy-audit"],
    evidenceClass: "strong",
    failClosedEligible: true,
    humanReviewRequired: true,
  },
  actions: ["open-tab", "run-analysis", "attach-to-admission-gate", "attach-to-policy-check"],
  workflow: {
    usableInStacks: ["ai-review-stack", "agent-delegation-stack"],
    canBeAutoSuggested: true,
    canBeAutoAttached: true,
    requiresOrderedExecution: true,
  },
  quality: {
    maturity: "advanced",
    owner: "ai-platform",
  },
  Component: BlastRadiusAgentModeView,
};
