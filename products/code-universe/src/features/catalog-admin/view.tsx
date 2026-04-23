import type { ReactElement } from "react";
import type { ViewContextValue, ViewDescriptor } from "../view-mode/model/view-descriptor";
import { CatalogAdminView } from "./ui/CatalogAdminView";

function CatalogAdminModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
  return <CatalogAdminView ctx={ctx} />;
}

export const catalogAdminViewDescriptor: ViewDescriptor = {
  id: "catalog-admin",
  label: "Catalog",
  glyph: "⌬",
  hint: "analysis catalog 메타데이터를 관리하는 범용 운영면",
  tech: "catalog metadata × domain/scope matrix × workflow-stack coverage",
  usecase: "엔진이 등록한 분석 catalog의 커버리지, 게이트 적합성, hygiene debt를 한 번에 확인.",
  category: "ai",
  contexts: ["repo"],
  order: 960,
  capabilityKinds: ["view", "policy-control"],
  taxonomy: {
    primary: {
      domain: "productivity",
      scope: "repo",
      intent: "govern",
    },
    domains: ["productivity", "ai-trust-governance"],
    scopes: ["repo", "project", "package", "folder", "file", "symbol", "diff", "task", "agent-run", "model", "budget", "policy"],
    intents: ["govern", "decide", "verify"],
    subdomain: "analysis-catalog",
    personas: ["manager", "platform", "tech-lead"],
    surfaces: ["view", "dashboard-card", "tab"],
    maturity: "advanced",
    signal: {
      dataFreshness: "snapshot",
      confidence: "measured",
      actionability: "triage",
      cost: "low",
      latency: "interactive",
      determinism: "deterministic",
      evidenceLevel: "auditable",
      decisionGrade: "gating",
    },
    related: ["quality-gate", "decision-log", "audit-trail", "task-queue"],
    keywords: ["catalog", "admin", "matrix", "workflow", "coverage", "gate", "hygiene"],
  },
  decision: {
    grade: "gating",
    supports: ["policy-audit", "merge", "delegate", "route-model", "escalate-review"],
    evidenceClass: "auditable",
    failClosedEligible: true,
    humanReviewRequired: false,
  },
  actions: ["open-tab", "pin-dashboard", "attach-to-admission-gate", "attach-to-policy-check"],
  workflow: {
    canBeAutoSuggested: true,
    canBeAutoAttached: true,
    requiresOrderedExecution: true,
    usableInStacks: ["ai-review-stack", "agent-delegation-stack", "context-engineering-stack", "agent-failure-stack"],
  },
  quality: {
    maturity: "advanced",
    owner: "platform",
    docs: "analysis-catalog",
  },
  Component: CatalogAdminModeView,
};
