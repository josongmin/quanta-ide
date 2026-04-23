// Stream Graph view descriptor — silhouette-layout stacked area.
//
// Reference: Byron & Wattenberg.
// "Stacked Graphs: Geometry & Aesthetics", IEEE InfoVis 2008.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { StreamGraphView } from "./ui/StreamGraphView";

function StreamGraphModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return (
    <StreamGraphView
      tree={ctx.tree}
      onFocusEntity={id => ctx.dispatch.selectEntity(id)}
    />
  );
}

export const streamGraphViewDescriptor: ViewDescriptor = {
  id: "stream-graph",
  label: "Stream",
  glyph: "≈",
  hint: "Stream Graph — 패키지 LoC 시간 흐름",
  tech: "Byron & Wattenberg InfoVis 2008 streamgraph layout",
  usecase: "'이 패키지 언제 폭발 성장했나' continuous overview.",
  category: "history",
  contexts: ["repo", "folder"],
  needs: { tree: true },
  order: 740,
  capabilityKinds: ["view", "decision-input", "policy-control"],
  taxonomy: {
    primary: { domain: "se-evolution", scope: "package", intent: "explain" },
    scopes: ["repo", "package", "folder"],
    intents: ["explain", "diagnose", "govern"],
    subdomain: "growth-streams",
    personas: ["developer", "tech-lead", "manager"],
    surfaces: ["view", "tab", "dashboard-card"],
    maturity: "advanced",
    signal: {
      dataFreshness: "snapshot",
      confidence: "measured",
      actionability: "explain",
      cost: "low",
      latency: "interactive",
      determinism: "deterministic",
      evidenceLevel: "strong",
      decisionGrade: "informational",
    },
    keywords: ["stream", "growth", "package", "history", "loc"],
  },
  decision: {
    grade: "informational",
    supports: ["policy-audit"],
    evidenceClass: "strong",
    failClosedEligible: false,
    humanReviewRequired: false,
  },
  actions: ["open-tab", "compare-related", "pin-dashboard"],
  workflow: {
    canBeAutoSuggested: true,
    canBeAutoAttached: false,
    requiresOrderedExecution: false,
  },
  quality: {
    maturity: "advanced",
    owner: "code-intel",
  },
  Component: StreamGraphModeView,
};
