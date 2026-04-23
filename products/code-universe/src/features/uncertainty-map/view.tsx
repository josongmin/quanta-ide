// UncertaintyMap view descriptor — model calibration reliability diagram.
// --------------------------------------------------------------------
// Per-file claimed vs actual accuracy, plotted as the classical
// reliability diagram. Dots above the diagonal = the model is too
// humble (underconfident); dots below = overconfident — the dangerous
// case: "AI says it's sure, but is often wrong".
//
// Reference: Guo et al. "On Calibration of Modern Neural Networks"
// ICML 2017 (the paper that made ECE mainstream). Kadavath et al.
// "Language Models Mostly Know What They Know" 2022. Wightman et al.
// "Calibration of LLMs" 2024.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { UncertaintyMapView } from "./ui/UncertaintyMapView";

function UncertaintyMapModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return <UncertaintyMapView ctx={ctx} />;
}

export const uncertaintyMapViewDescriptor: ViewDescriptor = {
  id: "uncertainty-map",
  label: "Uncert",
  glyph: "◍",
  hint: "모델 신뢰도 캘리브레이션",
  tech: "claimed confidence vs measured accuracy",
  usecase: "'AI가 sure하다'를 얼마나 믿어야 하는가. overconfident 지역 식별.",
  category: "ai",
  contexts: ["repo", "folder"],
  needs: { tree: true },
  order: 1130,
  capabilityKinds: ["view", "decision-input"],
  taxonomy: {
    primary: {
      domain: "ai-trust-governance",
      scope: "file",
      intent: "decide",
    },
    scopes: ["repo", "folder", "file"],
    intents: ["verify", "explain", "decide"],
    subdomain: "calibration",
    personas: ["developer", "reviewer", "ai-operator"],
    surfaces: ["view", "tab", "dashboard-card"],
    maturity: "advanced",
    signal: {
      dataFreshness: "snapshot",
      confidence: "measured",
      actionability: "triage",
      cost: "medium",
      latency: "interactive",
      determinism: "deterministic",
      evidenceLevel: "strong",
      decisionGrade: "advisory",
    },
    related: ["benchmark-gap", "hallucination-risk", "determinism-drift"],
    keywords: ["uncertainty", "calibration", "confidence", "ece"],
  },
  decision: {
    grade: "advisory",
    supports: ["merge", "delegate"],
    evidenceClass: "strong",
    failClosedEligible: false,
    humanReviewRequired: true,
  },
  actions: ["open-tab", "run-analysis", "attach-to-pr-review", "compare-related"],
  workflow: {
    usableInStacks: ["ai-review-stack", "agent-delegation-stack"],
    canBeAutoSuggested: true,
    canBeAutoAttached: false,
    requiresOrderedExecution: false,
  },
  quality: {
    maturity: "advanced",
    owner: "ai-platform",
  },
  Component: UncertaintyMapModeView,
};
