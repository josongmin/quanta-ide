// SkillAtrophy view descriptor — developer over-reliance on AI assistance.
// --------------------------------------------------------------------
// Reference: Microsoft Research / CMU 2025 on critical-thinking atrophy
// in AI-assisted knowledge work; Stanford HCI developer skill studies;
// ACM Queue 2024 on AI pair-programming trade-offs.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { SkillAtrophyView } from "./ui/SkillAtrophyView";

function SkillAtrophyModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return <SkillAtrophyView ctx={ctx} />;
}

export const skillAtrophyViewDescriptor: ViewDescriptor = {
  id: "skill-atrophy",
  label: "Atrophy",
  glyph: "↧",
  hint: "개발자 AI 과의존 트렌드",
  tech: "AI 비율 상승 × 인간 LoC 하락 composite 지수",
  usecase: "팀 건강성. 'AI 없으면 코딩 못 함' 단계 예방.",
  category: "ai",
  contexts: ["repo"],
  needs: { tree: true },
  order: 1040,
  capabilityKinds: ["view", "decision-input", "policy-control"],
  taxonomy: {
    primary: {
      domain: "se-ownership-team",
      scope: "team",
      intent: "govern",
    },
    scopes: ["team", "repo"],
    intents: ["govern", "diagnose", "optimize"],
    subdomain: "human-skill-health",
    personas: ["manager", "tech-lead"],
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
    related: ["review-burden", "ai-authorship", "devex-health"],
    keywords: ["skill", "atrophy", "overreliance", "team", "health"],
  },
  decision: {
    grade: "triage",
    supports: ["policy-audit", "escalate-review"],
    evidenceClass: "weak",
    failClosedEligible: false,
    humanReviewRequired: true,
  },
  actions: ["open-tab", "pin-dashboard", "attach-to-policy-check"],
  workflow: {
    canBeAutoSuggested: true,
    canBeAutoAttached: false,
    requiresOrderedExecution: false,
  },
  quality: {
    maturity: "advanced",
    owner: "platform",
  },
  Component: SkillAtrophyModeView,
};
