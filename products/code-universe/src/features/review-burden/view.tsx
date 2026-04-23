// ReviewBurden view descriptor — AI PR volume vs human review capacity.
// --------------------------------------------------------------------
// Reference: modern code review operations — trust only works if review
// capacity can keep up with AI-generated change volume.

import type { ReactElement } from "react";
import type { ViewContextValue, ViewDescriptor } from "../view-mode/model/view-descriptor";
import { ReviewBurdenView } from "./ui/ReviewBurdenView";

function ReviewBurdenModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return <ReviewBurdenView ctx={ctx} />;
}

export const reviewBurdenViewDescriptor = {
  id: "review-burden",
  label: "RevLoad",
  glyph: "▤",
  hint: "AI PR 양과 인간 리뷰 capacity 간의 충돌을 보여줌",
  tech: "review minutes × capacity × deep-review rate × auto-merge risk",
  usecase: "AI 도입 후 팀이 실제로 리뷰 가능한 양을 넘었는지 판단.",
  category: "ai",
  contexts: ["repo"],
  needs: { tree: true },
  order: 1220,
  capabilityKinds: ["view", "policy-control"],
  taxonomy: {
    primary: {
      domain: "productivity",
      scope: "team",
      intent: "govern",
    },
    domains: ["productivity", "ai-trust-governance"],
    scopes: ["team", "repo"],
    intents: ["govern", "decide"],
    subdomain: "review-capacity",
    personas: ["manager", "tech-lead", "reviewer"],
    surfaces: ["view", "dashboard-card", "tab"],
    maturity: "core",
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
    related: ["decision-log", "quality-gate", "audit-trail"],
    keywords: ["review", "capacity", "burden", "merge", "policy", "volume"],
  },
  decision: {
    grade: "triage",
    supports: ["escalate-review", "policy-audit"],
    evidenceClass: "strong",
    humanReviewRequired: true,
  },
  actions: ["open-tab", "pin-dashboard", "attach-to-policy-check"],
  workflow: {
    canBeAutoSuggested: true,
    canBeAutoAttached: true,
  },
  quality: {
    maturity: "core",
  },
  Component: ReviewBurdenModeView,
} as ViewDescriptor;
