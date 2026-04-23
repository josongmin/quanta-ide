// APISurface — descriptor for the sunburst-style public-API audit view.
// --------------------------------------------------------------------
// Center = workspace. Ring 1 = packages. Ring 2 = files that export
// symbols. Arc length ∝ export count; arc color intensity ∝ external
// usage count. Dead-weight arcs (exports nobody imports) render in a
// pale / desaturated tint so they visually recede.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { APISurfaceView } from "./ui/APISurfaceView";

function APISurfaceModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  return <APISurfaceView ctx={ctx} />;
}

export const apiSurfaceViewDescriptor: ViewDescriptor = {
  id: "api-surface",
  label: "API",
  glyph: "◈",
  hint: "공개 API 표면 감사",
  tech: "export 심볼 × 외부 import 교차 분석",
  usecase: "안 쓰이는 public API 찾기. 인터페이스 축소 후보.",
  category: "arch",
  contexts: ["repo"],
  needs: { tree: true },
  order: 520,
  capabilityKinds: ["view", "decision-input"],
  taxonomy: {
    primary: {
      domain: "se-architecture",
      scope: "package",
      intent: "verify",
    },
    scopes: ["repo", "package", "file"],
    intents: ["verify", "decide", "optimize"],
    subdomain: "public-api-audit",
    personas: ["developer", "tech-lead"],
    surfaces: ["view", "tab", "dashboard-card"],
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
    related: ["package-surface", "dependency-health", "dead-code"],
    keywords: ["api", "surface", "exports", "public"],
  },
  decision: {
    grade: "advisory",
    supports: ["refactor"],
    evidenceClass: "strong",
    failClosedEligible: false,
    humanReviewRequired: false,
  },
  actions: ["open-tab", "run-analysis", "compare-related"],
  workflow: {
    canBeAutoSuggested: true,
    canBeAutoAttached: false,
    requiresOrderedExecution: false,
  },
  quality: {
    maturity: "advanced",
    owner: "platform",
  },
  Component: APISurfaceModeView,
};
