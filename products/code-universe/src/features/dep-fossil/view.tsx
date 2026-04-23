// Fossil — descriptor for the deprecated-API timeline view.
// --------------------------------------------------------------------
// Horizontal axis = "first introduced" (oldest → newest). Each row =
// a deprecated / legacy API still alive in the codebase. Dots along
// the timeline = individual file uses. Row tint intensity ∝ total uses.
// Top rows = worst offenders so the user's eye falls straight on them.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { FossilView } from "./ui/FossilView";

function FossilModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  return <FossilView ctx={ctx} />;
}

export const depFossilViewDescriptor: ViewDescriptor = {
  id: "dep-fossil",
  label: "Fossil",
  glyph: "☍",
  hint: "화석 — 살아남은 deprecated API",
  tech: "import 스캔 × deprecated 목록",
  usecase: "청소 우선순위. 오래되고 지금도 쓰이는 legacy 식별.",
  category: "security",
  contexts: ["repo"],
  needs: { tree: true },
  order: 560,
  capabilityKinds: ["view", "decision-input", "policy-control"],
  taxonomy: {
    primary: {
      domain: "se-security-supply-chain",
      scope: "repo",
      intent: "diagnose",
    },
    scopes: ["repo", "package", "file"],
    intents: ["diagnose", "govern", "decide"],
    subdomain: "legacy-dependencies",
    personas: ["developer", "security", "tech-lead"],
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
    related: ["sbom", "dependency-health", "vulnerabilities"],
    keywords: ["deprecated", "fossil", "legacy", "api"],
  },
  decision: {
    grade: "triage",
    supports: ["policy-audit", "refactor"],
    evidenceClass: "strong",
    failClosedEligible: false,
    humanReviewRequired: true,
  },
  actions: ["open-tab", "run-analysis", "attach-to-policy-check"],
  workflow: {
    canBeAutoSuggested: true,
    canBeAutoAttached: false,
    requiresOrderedExecution: false,
  },
  quality: {
    maturity: "advanced",
    owner: "security",
  },
  Component: FossilModeView,
};
