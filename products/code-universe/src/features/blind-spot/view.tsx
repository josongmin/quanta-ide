// BlindSpot view descriptor — regions where model "doesn't know what
// it doesn't know" (proprietary APIs, novel libs, internal DSLs, domain).
// --------------------------------------------------------------------
// Reference: Kadavath et al. "Language Models (Mostly) Know What They
// Know" (2022); Liu et al. FSE 2024 hallucination taxonomy; novel OOD
// detection applied to code. High-blind-spot files are prime candidates
// for confabulation — pre-emptive human review lowers deployment risk.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { BlindSpotView } from "./ui/BlindSpotView";

function BlindSpotModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return <BlindSpotView ctx={ctx} />;
}

export const blindSpotViewDescriptor: ViewDescriptor = {
  id: "blind-spot",
  label: "Blind",
  glyph: "○",
  hint: "모델이 모르는 걸 모르는 지역",
  tech: "독점 API × 신규 lib × 내부 DSL × 도메인 특수성 composite",
  usecase: "에이전트가 confabulate할 지역 선제 식별. 리뷰 우선순위.",
  category: "ai",
  contexts: ["repo", "folder"],
  needs: { tree: true },
  order: 1020,
  capabilityKinds: ["view", "decision-input"],
  taxonomy: {
    primary: {
      domain: "ai-trust-governance",
      scope: "file",
      intent: "diagnose",
    },
    scopes: ["repo", "folder", "file"],
    intents: ["diagnose", "verify", "decide"],
    subdomain: "ood-risk",
    personas: ["developer", "reviewer", "tech-lead"],
    surfaces: ["view", "tab", "dashboard-card"],
    maturity: "advanced",
    signal: {
      dataFreshness: "snapshot",
      confidence: "estimated",
      actionability: "triage",
      cost: "medium",
      latency: "interactive",
      determinism: "bounded",
      evidenceLevel: "weak",
      decisionGrade: "advisory",
    },
    related: ["hallucination-risk", "eval-contamination", "agentability"],
    keywords: ["blind", "spot", "proprietary", "dsl", "ood"],
  },
  decision: {
    grade: "advisory",
    supports: ["delegate", "merge", "escalate-review"],
    evidenceClass: "weak",
    failClosedEligible: false,
    humanReviewRequired: true,
  },
  actions: ["open-tab", "run-analysis", "attach-to-pr-review", "compare-related"],
  workflow: {
    usableInStacks: ["ai-review-stack", "agent-delegation-stack"],
    canBeAutoSuggested: true,
    canBeAutoAttached: true,
    requiresOrderedExecution: false,
  },
  quality: {
    maturity: "advanced",
    owner: "ai-platform",
  },
  Component: BlindSpotModeView,
};
