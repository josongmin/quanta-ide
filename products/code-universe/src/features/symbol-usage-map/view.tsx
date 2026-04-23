// SymbolUsageMap — descriptor for the repo-wide per-symbol usage heatmap.
// --------------------------------------------------------------------
// Reference: Voinea/Telea "CVSgrab" (SoftVis 2006); Wheeldon/Counsell
// "CodeSurveyor" treemap usage maps. Each file in the repo is a tile,
// colour-tinted by how many times the focused symbol is referenced
// inside. White/faded = 0 hits, accent tint deepens with hit count.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { SymbolUsageMapView } from "./ui/SymbolUsageMapView";

function SymbolUsageMapModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return <SymbolUsageMapView ctx={ctx} />;
}

export const symbolUsageMapViewDescriptor: ViewDescriptor = {
  id: "symbol-usage-map",
  label: "SymUsage",
  glyph: "▦",
  hint: "심볼 사용 맵 — repo 전체 heatmap",
  tech: "symbol reference index × per-file hit 집계",
  usecase: "공개 API 심볼 영향 범위 시각화. 제거 전 실사용처 확인.",
  category: "deps",
  contexts: ["file"],
  needs: { tree: true, selection: true },
  order: 220,
  capabilityKinds: ["view", "decision-input"],
  taxonomy: {
    primary: { domain: "se-architecture", scope: "symbol", intent: "verify" },
    scopes: ["repo", "file", "symbol"],
    intents: ["verify", "diagnose", "decide"],
    subdomain: "symbol-references",
    personas: ["developer", "reviewer", "tech-lead"],
    surfaces: ["view", "hover", "tab"],
    maturity: "advanced",
    signal: {
      dataFreshness: "snapshot",
      confidence: "measured",
      actionability: "direct-action",
      cost: "low",
      latency: "interactive",
      determinism: "deterministic",
      evidenceLevel: "strong",
      decisionGrade: "advisory",
    },
    keywords: ["symbol", "usage", "references", "api", "heatmap"],
  },
  decision: {
    grade: "advisory",
    supports: ["merge", "refactor"],
    evidenceClass: "strong",
    failClosedEligible: false,
    humanReviewRequired: false,
  },
  actions: ["open-view", "open-tab", "run-analysis", "compare-related"],
  workflow: {
    canBeAutoSuggested: true,
    canBeAutoAttached: false,
    requiresOrderedExecution: false,
  },
  quality: {
    maturity: "advanced",
    owner: "code-intel",
  },
  Component: SymbolUsageMapModeView,
};
