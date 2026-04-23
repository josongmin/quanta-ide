// Quality Gate view — Sonar-style executive pass/fail dashboard.
// Reference: SonarSource "Quality Gate" — combines Reliability / Security
// / Maintainability ratings A-E + Coverage / Duplication / Debt Ratio
// against configured thresholds.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { QualityGateView } from "./ui/QualityGateView";

function QualityGateModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return <QualityGateView ctx={ctx} />;
}

export const qualityGateViewDescriptor: ViewDescriptor = {
  id: "quality-gate",
  label: "Gate",
  glyph: "✓",
  hint: "Sonar식 Quality Gate — 핵심 지표 합격/불합격",
  tech: "Reliability/Security/Maintainability A-E × 커버리지 × 중복 × 부채 비율",
  usecase: "임원/PM 주간 보고. 핵심 품질 지표 한 화면. 릴리즈 게이트 체크.",
  category: "quality",
  contexts: ["repo"],
  needs: { tree: true },
  order: 350,
  capabilityKinds: ["view", "decision-input", "gate-check", "policy-control"],
  taxonomy: {
    primary: {
      domain: "se-quality",
      scope: "repo",
      intent: "verify",
    },
    scopes: ["repo", "folder"],
    intents: ["verify", "govern"],
    personas: ["manager", "tech-lead", "developer"],
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
      decisionGrade: "gating",
    },
    domains: ["se-quality", "se-testing"],
    subdomain: "quality-gating",
    related: ["coverage-holes", "mutation-score", "debt-ratio"],
    keywords: ["quality-gate", "coverage", "duplication", "debt", "release"],
  },
  decision: {
    grade: "gating",
    supports: ["merge", "policy-audit"],
    evidenceClass: "auditable",
    failClosedEligible: true,
    humanReviewRequired: true,
  },
  actions: ["open-tab", "run-analysis", "attach-to-admission-gate", "attach-to-policy-check", "pin-dashboard"],
  workflow: {
    usableInStacks: ["ai-review-stack"],
    canBeAutoSuggested: true,
    canBeAutoAttached: true,
    requiresOrderedExecution: true,
  },
  quality: {
    maturity: "core",
    owner: "quality",
  },
  Component: QualityGateModeView,
};
