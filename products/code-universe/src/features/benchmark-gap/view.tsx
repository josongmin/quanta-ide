// BenchmarkGap view descriptor — repo difficulty vs public agent benchmarks.
// --------------------------------------------------------------------
// Reference: Jimenez et al. SWE-bench / SWE-bench Verified (2024);
// OpenAI SWE-Lancer 2025; Yang et al. SWE-Agent.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { BenchmarkGapView } from "./ui/BenchmarkGapView";

function BenchmarkGapModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return <BenchmarkGapView ctx={ctx} />;
}

export const benchmarkGapViewDescriptor: ViewDescriptor = {
  id: "benchmark-gap",
  label: "BenchGap",
  glyph: "≠",
  hint: "우리 repo vs 공개 벤치마크 격차",
  tech: "SWE-bench Verified × SWE-Lancer × agentSuccessProbability 대조",
  usecase: "'SWE-bench 60%' → '우리 repo 20%'. 에이전트 배포 기대치 현실화.",
  category: "ai",
  contexts: ["repo"],
  needs: { tree: true },
  order: 1050,
  capabilityKinds: ["view", "decision-input"],
  taxonomy: {
    primary: {
      domain: "ai-trust-governance",
      scope: "repo",
      intent: "explain",
    },
    scopes: ["repo", "task", "model"],
    intents: ["explain", "decide", "govern"],
    subdomain: "benchmark-reality-gap",
    personas: ["manager", "tech-lead", "ai-operator"],
    surfaces: ["view", "tab", "dashboard-card"],
    maturity: "advanced",
    signal: {
      dataFreshness: "snapshot",
      confidence: "measured",
      actionability: "triage",
      cost: "low",
      latency: "interactive",
      determinism: "bounded",
      evidenceLevel: "strong",
      decisionGrade: "advisory",
    },
    related: ["agent-success", "eval-contamination", "benchmark-gap"],
    keywords: ["benchmark", "gap", "swe-bench", "lancer", "reality"],
  },
  decision: {
    grade: "advisory",
    supports: ["delegate", "route-model"],
    evidenceClass: "strong",
    failClosedEligible: false,
    humanReviewRequired: false,
  },
  actions: ["open-tab", "run-analysis", "pin-dashboard", "compare-related"],
  workflow: {
    canBeAutoSuggested: true,
    canBeAutoAttached: false,
    requiresOrderedExecution: false,
  },
  quality: {
    maturity: "advanced",
    owner: "ai-platform",
  },
  Component: BenchmarkGapModeView,
};
