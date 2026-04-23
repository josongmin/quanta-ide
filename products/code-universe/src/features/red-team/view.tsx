// RedTeam view descriptor — adversarial prompt test suite.
// --------------------------------------------------------------------
// Reference:
//   - Perez et al. "Red Teaming LMs with LMs" (2022)
//   - OWASP LLM Top 10 (2025)
//   - Anthropic "Constitutional AI" (2022)
//   - DEF CON AI Red Team (2023)
//
// Catalog of safety tests grouped by attack category (prompt-injection,
// jailbreak, data-exfil, unsafe-tool, sycophancy, pii-leak). Each row
// shows expected vs. actual behaviour and a pass/fail chip. Bottom
// heatmap summarises per-category pass rate; right panel carries a
// "run suite" stub and OWASP coverage insight.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { RedTeamView } from "./ui/RedTeamView";

function RedTeamModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return <RedTeamView ctx={ctx} />;
}

export const redTeamViewDescriptor: ViewDescriptor = {
  id: "red-team",
  label: "RedTeam",
  glyph: "⚠",
  hint: "적대적 프롬프트 안전성 테스트",
  tech: "OWASP LLM Top 10 × refusal/sanitize 예상 vs 실제",
  usecase: "deploy 전 안전성 감사. 실패 테스트 = 즉시 fix.",
  category: "ai",
  contexts: ["repo"],
  needs: { tree: true },
  order: 1180,
  capabilityKinds: ["view", "decision-input", "gate-check", "policy-control"],
  taxonomy: {
    primary: {
      domain: "ai-trust-governance",
      scope: "repo",
      intent: "decide",
    },
    scopes: ["repo", "policy", "file"],
    intents: ["verify", "govern", "decide"],
    subdomain: "adversarial-testing",
    personas: ["security", "ai-operator", "manager"],
    surfaces: ["view", "tab", "dashboard-card"],
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
    related: ["prompt-injection", "audit-trail", "catalog-admin"],
    keywords: ["red-team", "owasp", "adversarial", "safety", "suite"],
  },
  decision: {
    grade: "gating",
    supports: ["policy-audit", "merge"],
    evidenceClass: "strong",
    failClosedEligible: false,
    humanReviewRequired: true,
  },
  actions: ["open-tab", "run-analysis", "attach-to-policy-check", "attach-to-admission-gate"],
  workflow: {
    usableInStacks: ["ai-review-stack"],
    canBeAutoSuggested: true,
    canBeAutoAttached: true,
    requiresOrderedExecution: true,
  },
  quality: {
    maturity: "advanced",
    owner: "security",
  },
  Component: RedTeamModeView,
};
