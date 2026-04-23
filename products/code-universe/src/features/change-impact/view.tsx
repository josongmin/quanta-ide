// ChangeImpact view descriptor — transitive dependent closure.
// Reference: Bohner & Arnold, "Software Change Impact Analysis",
// IEEE CS Press 1996.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { ChangeImpactView } from "./ui/ChangeImpactView";

function ChangeImpactModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.graph) return null;
  return (
    <ChangeImpactView
      graph={ctx.graph}
      tree={ctx.tree}
      selectedId={ctx.selectedId}
      width={ctx.viewportSize.w}
      height={ctx.viewportSize.h}
      onFocusEntity={id => ctx.dispatch.selectEntity(id)}
    />
  );
}

export const changeImpactViewDescriptor: ViewDescriptor = {
  id: "change-impact",
  label: "Impact",
  glyph: "⟳",
  hint: "변경 영향 — 전이적 도달 집합",
  tech: "BFS over 의존성 그래프",
  usecase: "리팩터링 전 '이 파일 바꾸면 몇 개 파일 영향?' 정확한 closure.",
  category: "deps",
  contexts: ["file", "folder", "repo"],
  needs: { graph: true, selection: true },
  order: 130,
  capabilityKinds: ["view", "decision-input", "workflow-step"],
  taxonomy: {
    primary: {
      domain: "se-refactor-change",
      scope: "module",
      intent: "decide",
    },
    scopes: ["module", "folder", "file", "repo"],
    intents: ["decide", "diagnose"],
    personas: ["manager", "tech-lead", "developer"],
    surfaces: ["view", "tab"],
    maturity: "core",
    signal: {
      dataFreshness: "snapshot",
      confidence: "measured",
      actionability: "direct-action",
      cost: "medium",
      latency: "interactive",
      determinism: "deterministic",
      evidenceLevel: "strong",
      decisionGrade: "advisory",
    },
    domains: ["se-refactor-change", "se-quality"],
    subdomain: "impact-analysis",
    related: ["program-slice", "call-graph", "hotspot"],
    keywords: ["impact", "closure", "dependents", "blast-radius", "bfs"],
  },
  decision: {
    grade: "advisory",
    supports: ["merge", "refactor", "delegate"],
    evidenceClass: "strong",
  },
  actions: ["open-tab", "run-analysis", "compare-related", "attach-to-pr-review"],
  workflow: {
    canBeAutoSuggested: true,
    canBeAutoAttached: true,
  },
  quality: {
    maturity: "core",
    owner: "platform",
  },
  Component: ChangeImpactModeView,
};
