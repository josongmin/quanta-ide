// DecisionLog view descriptor — Architectural Decision Records viewer.
// Reference: Michael Nygard, "Documenting Architecture Decisions"
// (Relevance, 2011); MADR — Markdown Architecture Decision Records.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { DecisionLogView } from "./ui/DecisionLogView";

function DecisionLogModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return <DecisionLogView ctx={ctx} />;
}

export const decisionLogViewDescriptor: ViewDescriptor = {
  id: "decision-log",
  label: "ADR",
  glyph: "⌘",
  hint: "아키 결정 로그 — ADR",
  tech: "Nygard ADR 2011 × MADR 포맷",
  usecase: "과거 결정 문서화. 에이전트가 이 규칙들을 준수하도록 컨텍스트.",
  category: "ai",
  contexts: ["repo"],
  needs: { tree: true },
  order: 950,
  capabilityKinds: ["view", "decision-input", "gate-check", "policy-control"],
  taxonomy: {
    primary: {
      domain: "ai-trust-governance",
      scope: "task",
      intent: "govern",
    },
    scopes: ["repo", "policy", "task", "diff"],
    intents: ["govern", "verify", "decide"],
    subdomain: "decision-audit",
    personas: ["manager", "tech-lead", "reviewer"],
    surfaces: ["view", "tab", "dashboard-card"],
    maturity: "advanced",
    signal: {
      dataFreshness: "snapshot",
      confidence: "measured",
      actionability: "direct-action",
      cost: "low",
      latency: "interactive",
      determinism: "deterministic",
      evidenceLevel: "auditable",
      decisionGrade: "gating",
    },
    related: ["audit-trail", "diff-evidence", "catalog-admin"],
    keywords: ["decision", "log", "adr", "policy", "compliance"],
  },
  decision: {
    grade: "gating",
    supports: ["policy-audit", "merge", "delegate"],
    evidenceClass: "auditable",
    failClosedEligible: false,
    humanReviewRequired: false,
  },
  actions: ["open-tab", "run-analysis", "attach-to-policy-check", "attach-to-admission-gate"],
  workflow: {
    canBeAutoSuggested: true,
    canBeAutoAttached: true,
    requiresOrderedExecution: false,
  },
  quality: {
    maturity: "advanced",
    owner: "platform",
  },
  Component: DecisionLogModeView,
};
