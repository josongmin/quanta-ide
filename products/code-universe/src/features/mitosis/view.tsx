// Mitosis view descriptor — ownership split / merge-conflict prediction.
// --------------------------------------------------------------------
// Each cell = a file whose top-two authors have closely-matched shares
// (|diff| < 0.25) and ≥2 authors total. Visual: two overlapping circles
// separating like a mitotic cell. Distance between circles ∝ conflict
// probability. Click → expanded inline timeline of commit interleaving.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { MitosisView } from "./ui/MitosisView";

function MitosisModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
  return <MitosisView ctx={ctx} />;
}

export const mitosisViewDescriptor: ViewDescriptor = {
  id: "mitosis",
  label: "Mitosis",
  glyph: "◎",
  hint: "소유권 분열 경고",
  tech: "최근 commits의 저자 교차 빈도",
  usecase: "다가오는 merge conflict / 팀 겹침 예측.",
  category: "team",
  contexts: ["repo", "folder"],
  needs: { tree: true },
  order: 620,
  capabilityKinds: ["view", "decision-input", "policy-control"],
  taxonomy: {
    primary: {
      domain: "se-ownership-team",
      scope: "team",
      intent: "diagnose",
    },
    scopes: ["repo", "folder", "team"],
    intents: ["diagnose", "govern", "decide"],
    subdomain: "ownership-split",
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
    related: ["truck-factor", "ownership-sankey", "review-heat"],
    keywords: ["mitosis", "ownership", "split", "conflict"],
  },
  decision: {
    grade: "triage",
    supports: ["escalate-review", "policy-audit"],
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
  Component: MitosisModeView,
};
