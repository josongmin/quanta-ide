// AuditTrail view descriptor.
// --------------------------------------------------------------------
// Chronological log of every agent action. Filters × timeline list ×
// 24h × 14d activity heatmap sidebar.
//
// Reference: SOC2 / ISO 27001 audit log standards; Kubernetes audit
// log; AWS CloudTrail.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { AuditTrailView } from "./ui/AuditTrailView";

function AuditTrailModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
  return <AuditTrailView ctx={ctx} />;
}

export const auditTrailViewDescriptor: ViewDescriptor = {
  id: "audit-trail",
  label: "Audit",
  glyph: "◰",
  hint: "감사 로그 — 에이전트의 모든 액션",
  tech: "SOC2 audit log × action kind × outcome",
  usecase: "보안 감사. '에이전트가 뭘 건드렸나' 타임라인. 규제 대응.",
  category: "ai",
  contexts: ["repo"],
  needs: { tree: true },
  order: 1000,
  capabilityKinds: ["view", "decision-input", "gate-check", "policy-control"],
  taxonomy: {
    primary: {
      domain: "ai-trust-governance",
      scope: "policy",
      intent: "govern",
    },
    scopes: ["repo", "team", "policy", "agent-run"],
    intents: ["govern", "verify", "explain"],
    subdomain: "audit-logging",
    personas: ["security", "manager", "platform"],
    surfaces: ["view", "tab", "dashboard-card"],
    maturity: "core",
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
    related: ["decision-log", "prompt-injection", "catalog-admin"],
    keywords: ["audit", "trail", "logs", "soc2", "cloudtrail"],
  },
  decision: {
    grade: "gating",
    supports: ["policy-audit", "merge", "delegate"],
    evidenceClass: "auditable",
    failClosedEligible: true,
    humanReviewRequired: false,
  },
  actions: ["open-tab", "pin-dashboard", "attach-to-policy-check", "attach-to-admission-gate"],
  workflow: {
    canBeAutoSuggested: true,
    canBeAutoAttached: true,
    requiresOrderedExecution: false,
  },
  quality: {
    maturity: "core",
    owner: "security",
  },
  Component: AuditTrailModeView,
};
