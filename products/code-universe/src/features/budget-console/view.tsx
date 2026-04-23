// BudgetConsole view descriptor.
// --------------------------------------------------------------------
// Monthly AI spend governance — hero current-month / cap, 12mo
// history bar chart, category breakdown, top spenders, projection.
//
// Reference: FinOps framework; AWS / GCP billing dashboards;
// Anthropic Admin API cost tracking.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { BudgetConsoleView } from "./ui/BudgetConsoleView";

function BudgetConsoleModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
  return <BudgetConsoleView ctx={ctx} />;
}

export const budgetConsoleViewDescriptor: ViewDescriptor = {
  id: "budget-console",
  label: "Budget",
  glyph: "$",
  hint: "AI 예산 콘솔 — 월별 거버넌스",
  tech: "FinOps × 카테고리별 breakdown × 프로젝션",
  usecase: "AI 비용 통제. 초과 알림. 팀별 쿼터 관리.",
  category: "ai",
  contexts: ["repo"],
  needs: { tree: true },
  order: 990,
  capabilityKinds: ["view", "decision-input", "policy-control"],
  taxonomy: {
    primary: {
      domain: "productivity",
      scope: "budget",
      intent: "govern",
    },
    scopes: ["team", "repo", "budget", "model"],
    intents: ["govern", "optimize", "decide"],
    subdomain: "ai-finops",
    personas: ["manager", "platform", "ai-operator"],
    surfaces: ["view", "tab", "dashboard-card"],
    maturity: "core",
    signal: {
      dataFreshness: "snapshot",
      confidence: "measured",
      actionability: "direct-action",
      cost: "medium",
      latency: "interactive",
      determinism: "deterministic",
      evidenceLevel: "auditable",
      decisionGrade: "advisory",
    },
    related: ["token-economy", "agent-roi", "cache-roi"],
    keywords: ["budget", "console", "finops", "spend", "projection"],
  },
  decision: {
    grade: "advisory",
    supports: ["policy-audit", "route-model"],
    evidenceClass: "auditable",
    failClosedEligible: false,
    humanReviewRequired: false,
  },
  actions: ["open-tab", "pin-dashboard", "attach-to-policy-check", "run-analysis"],
  workflow: {
    canBeAutoSuggested: true,
    canBeAutoAttached: false,
    requiresOrderedExecution: false,
  },
  quality: {
    maturity: "core",
    owner: "platform",
  },
  Component: BudgetConsoleModeView,
};
