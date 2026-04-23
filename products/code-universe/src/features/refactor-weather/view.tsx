// Refactor Weather view — forecast dashboard for proposed refactoring.
//
// Where `refactor-sim` SIMULATES a specific refactor and shows its
// simulated blast, Weather is the higher-level DASHBOARD: each package
// gets a weather condition (맑음/흐림/비/폭풍) aggregating multiple
// risk signals so you see the whole climate at once.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { RefactorWeatherView } from "./ui/RefactorWeatherView";

function RefactorWeatherModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return <RefactorWeatherView ctx={ctx} />;
}

export const refactorWeatherViewDescriptor: ViewDescriptor = {
  id: "refactor-weather",
  label: "Weather",
  glyph: "☁",
  hint: "리팩터링 기상 예보"
,
  tech: "복잡도 × 결합도 × churn 집계 기상도",
  usecase: "전체 패키지의 리팩터 '날씨' 한 눈에. 폭풍 지역부터 손대자.",
  category: "refactor",
  contexts: ["repo"],
  needs: { tree: true },
  order: 480,
  capabilityKinds: ["view", "decision-input"],
  taxonomy: {
    primary: { domain: "se-refactor-change", scope: "package", intent: "govern" },
    scopes: ["repo", "package", "folder"],
    intents: ["diagnose", "govern", "decide"],
    subdomain: "refactor-climate",
    personas: ["developer", "tech-lead", "manager"],
    surfaces: ["view", "tab", "dashboard-card"],
    maturity: "advanced",
    signal: {
      dataFreshness: "snapshot",
      confidence: "measured",
      actionability: "triage",
      cost: "low",
      latency: "interactive",
      determinism: "deterministic",
      evidenceLevel: "strong",
      decisionGrade: "triage",
    },
    keywords: ["refactor", "weather", "package", "storm", "churn"],
  },
  decision: {
    grade: "triage",
    supports: ["refactor"],
    evidenceClass: "strong",
    failClosedEligible: false,
    humanReviewRequired: false,
  },
  actions: ["open-tab", "run-analysis", "pin-dashboard"],
  workflow: {
    canBeAutoSuggested: true,
    canBeAutoAttached: false,
    requiresOrderedExecution: false,
  },
  quality: {
    maturity: "advanced",
    owner: "code-intel",
  },
  Component: RefactorWeatherModeView,
};
