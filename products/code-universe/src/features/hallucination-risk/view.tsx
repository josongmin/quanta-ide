// HallucinationRisk view descriptor — repo-level LLM hallucination risk.
// --------------------------------------------------------------------
// Reference: Liu et al. "Exploring and Evaluating Hallucinations in LLM-
// based Code Generation" FSE 2024; Jesse et al. "Large Language Models
// and Simple, Stupid Bugs" ICSE 2023. Identifies files where AI is most
// likely to fabricate API shapes or invent symbols — triage targets for
// docstring coverage and generic-type reduction.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { HallucinationRiskView } from "./ui/HallucinationRiskView";

function HallucinationRiskModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return <HallucinationRiskView ctx={ctx} />;
}

export const hallucinationRiskViewDescriptor: ViewDescriptor = {
  id: "hallucination-risk",
  label: "Halluc",
  glyph: "◌",
  hint: "LLM 환각 리스크 — API 희귀도 × 문서 부재",
  tech: "API entropy × doc density × dynamic dispatch × generic types",
  usecase: "AI가 거짓 API 지어낼 가능성 높은 파일 식별. 문서화 우선순위.",
  category: "ai",
  contexts: ["repo", "folder"],
  needs: { tree: true },
  order: 790,
  capabilityKinds: ["view", "decision-input"],
  taxonomy: {
    primary: {
      domain: "ai-trust-governance",
      scope: "repo",
      intent: "diagnose",
    },
    scopes: ["repo", "folder", "file"],
    intents: ["diagnose", "verify", "decide"],
    subdomain: "hallucination-risk",
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
    related: ["blind-spot", "verification-surface", "prompt-injection"],
    keywords: ["hallucination", "risk", "api", "entropy", "docs"],
  },
  decision: {
    grade: "advisory",
    supports: ["merge", "delegate", "escalate-review"],
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
  Component: HallucinationRiskModeView,
};
