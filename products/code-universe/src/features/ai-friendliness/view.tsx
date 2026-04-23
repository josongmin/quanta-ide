// AI Friendliness view descriptor — token cost × LLM-readability scatter.
// --------------------------------------------------------------------
// Reference: Novel concept — "AI-friendliness as a code quality
// dimension". Inspired by Uwano et al. "Analyzing individual performance
// of source code review using reviewers' eye movement" (ICSE 2006)
// adapted for LLMs; Mockus & Votta "Identifying reasons for software
// changes using historic databases" (ICSM 2000).

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { AIFriendlinessView } from "./ui/AIFriendlinessView";

function AIFriendlinessModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
  return <AIFriendlinessView ctx={ctx} />;
}

export const aiFriendlinessViewDescriptor: ViewDescriptor = {
  id: "ai-friendliness",
  label: "Friendly",
  glyph: "⋆",
  hint: "AI 친화도 × 토큰 비용 scatter",
  tech: "토큰 추정 × 6-factor 친화도 composite",
  usecase:
    "'AI가 이 파일 못 읽을 것 같다' 직관을 수치화. 온보딩 순서 결정.",
  category: "ai",
  contexts: ["repo", "folder"],
  needs: { tree: true },
  order: 720,
  capabilityKinds: ["view", "decision-input"],
  taxonomy: {
    primary: {
      domain: "ai-context-model",
      scope: "repo",
      intent: "diagnose",
    },
    scopes: ["repo", "folder", "file"],
    intents: ["diagnose", "decide", "optimize"],
    subdomain: "llm-readability",
    personas: ["developer", "tech-lead", "manager"],
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
      decisionGrade: "advisory",
    },
    related: ["agent-success", "hallucination-risk", "readiness-score"],
    keywords: ["ai", "friendliness", "readability", "scatter", "onboarding"],
  },
  decision: {
    grade: "advisory",
    supports: ["delegate", "route-model"],
    evidenceClass: "weak",
    failClosedEligible: false,
    humanReviewRequired: true,
  },
  actions: ["open-tab", "run-analysis", "pin-dashboard", "compare-related"],
  workflow: {
    usableInStacks: ["agent-delegation-stack"],
    canBeAutoSuggested: true,
    canBeAutoAttached: false,
    requiresOrderedExecution: false,
  },
  quality: {
    maturity: "advanced",
    owner: "ai-platform",
  },
  Component: AIFriendlinessModeView,
};
