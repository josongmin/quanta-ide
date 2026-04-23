// BugPrediction view descriptor — defect-likelihood heatmap.
// --------------------------------------------------------------------
// Weighted combination of complexity, churn and coupling produces a
// per-file bug-probability score. The view renders the result as a
// folder-nested grid of tiles coloured by risk (red / amber / green).
//
// Reference: Zimmermann PROMISE 2007 ("Predicting Defects for Eclipse")
//            + Nagappan & Ball MSR work on churn-based defect models.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { BugPredictionView } from "./ui/BugPredictionView";

function BugPredictionModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
  return <BugPredictionView ctx={ctx} />;
}

export const bugPredictionViewDescriptor: ViewDescriptor = {
  id: "bug-prediction",
  label: "BugRisk",
  glyph: "◑",
  hint: "결함 예측 — 복잡도+churn+결합도 모델",
  tech: "Zimmermann/Nagappan defect prediction weighted sum",
  usecase: "어디서 다음 버그 터질지 사전 경고. 코드리뷰 우선순위.",
  category: "metrics",
  contexts: ["repo", "folder"],
  needs: { tree: true },
  order: 310,
  capabilityKinds: ["view", "decision-input"],
  taxonomy: {
    primary: {
      domain: "se-testing",
      scope: "repo",
      intent: "diagnose",
    },
    scopes: ["repo", "folder"],
    intents: ["diagnose", "verify"],
    personas: ["developer", "reviewer", "tech-lead"],
    surfaces: ["view", "tab", "dashboard-card"],
    maturity: "advanced",
    signal: {
      dataFreshness: "snapshot",
      confidence: "estimated",
      actionability: "triage",
      cost: "low",
      latency: "interactive",
      determinism: "bounded",
      evidenceLevel: "weak",
      decisionGrade: "triage",
    },
    domains: ["se-testing", "se-quality"],
    subdomain: "defect-prediction",
    related: ["hotspot", "coverage-holes", "mutation-score"],
    keywords: ["bug-prediction", "defect", "churn", "complexity", "coupling"],
  },
  decision: {
    grade: "triage",
    supports: ["refactor", "merge"],
    evidenceClass: "weak",
  },
  actions: ["open-tab", "run-analysis", "compare-related", "pin-dashboard"],
  workflow: {
    canBeAutoSuggested: true,
  },
  quality: {
    maturity: "advanced",
    owner: "quality",
  },
  Component: BugPredictionModeView,
};
