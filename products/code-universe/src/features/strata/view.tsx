// Strata view descriptor — geological strata by file age.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { StrataView } from "./ui/StrataView";

function StrataModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return <StrataView ctx={ctx} />;
}

export const strataViewDescriptor: ViewDescriptor = {
  id: "strata",
  label: "Strata",
  glyph: "☰",
  hint: "지층 — 파일 생성 시점별 분포",
  tech: "git log 첫 커밋 타임스탬프",
  usecase: "레거시 영역 식별. '가장 오래된 뼈대' 발굴.",
  category: "history",
  contexts: ["repo", "folder"],
  needs: { tree: true },
  order: 670,
  capabilityKinds: ["view", "decision-input", "policy-control"],
  taxonomy: {
    primary: { domain: "se-evolution", scope: "repo", intent: "explain" },
    scopes: ["repo", "package", "file"],
    intents: ["explain", "diagnose", "govern"],
    subdomain: "age-strata",
    personas: ["developer", "tech-lead", "manager"],
    surfaces: ["view", "tab", "dashboard-card"],
    maturity: "advanced",
    signal: {
      dataFreshness: "snapshot",
      confidence: "measured",
      actionability: "explain",
      cost: "low",
      latency: "interactive",
      determinism: "deterministic",
      evidenceLevel: "strong",
      decisionGrade: "informational",
    },
    keywords: ["strata", "age", "legacy", "history", "foundation"],
  },
  decision: {
    grade: "informational",
    supports: ["policy-audit"],
    evidenceClass: "strong",
    failClosedEligible: false,
    humanReviewRequired: false,
  },
  actions: ["open-tab", "compare-related", "pin-dashboard"],
  workflow: {
    canBeAutoSuggested: true,
    canBeAutoAttached: false,
    requiresOrderedExecution: false,
  },
  quality: {
    maturity: "advanced",
    owner: "code-intel",
  },
  Component: StrataModeView,
};
