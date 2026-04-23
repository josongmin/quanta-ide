// Seesoft view descriptor — line-oriented pixel-strip atlas.
//
// Reference: Eick, Steffen, Sumner. "SeeSoft — A Tool for Visualizing
// Line-Oriented Software Statistics", IEEE TSE 1992.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { SeesoftView } from "./ui/SeesoftView";

function SeesoftModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return (
    <SeesoftView
      tree={ctx.tree}
      selectedId={ctx.selectedId}
      onFocusEntity={id => ctx.dispatch.selectEntity(id)}
    />
  );
}

export const seesoftViewDescriptor: ViewDescriptor = {
  id: "seesoft",
  label: "Seesoft",
  glyph: "▤",
  hint: "Seesoft — 파일을 픽셀 스트립으로",
  tech: "Eick et al. TSE 1992 line-oriented viz",
  usecase: "huge repo를 한 이미지로. 핫라인/오래된 영역 한눈에.",
  category: "metrics",
  contexts: ["repo", "folder"],
  needs: { tree: true },
  order: 340,
  capabilityKinds: ["view"],
  taxonomy: {
    primary: { domain: "explore", scope: "repo", intent: "explain" },
    scopes: ["repo", "package", "file"],
    intents: ["explore", "explain"],
    subdomain: "line-density",
    personas: ["developer", "tech-lead", "manager"],
    surfaces: ["view", "tab", "dashboard-card"],
    maturity: "advanced",
    signal: {
      dataFreshness: "snapshot",
      confidence: "estimated",
      actionability: "explain",
      cost: "medium",
      latency: "interactive",
      determinism: "bounded",
      evidenceLevel: "weak",
      decisionGrade: "informational",
    },
    keywords: ["seesoft", "lines", "pixel", "heatmap", "history"],
  },
  decision: {
    grade: "informational",
    supports: [],
    evidenceClass: "weak",
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
    owner: "design-engineering",
  },
  Component: SeesoftModeView,
};
