// CallGraph view descriptor — file-level call/import graph with a
// Sugiyama-style stratified layout (columns = rough topological rank).
// Reference: Doxygen/Understand (classic, since 1990s), Sugiyama 1981.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { CallGraphView } from "./ui/CallGraphView";

function CallGraphModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.graph) return null;
  return (
    <CallGraphView
      graph={ctx.graph}
      tree={ctx.tree}
      selectedId={ctx.selectedId}
      width={ctx.viewportSize.w}
      height={ctx.viewportSize.h}
      onFocusEntity={id => ctx.dispatch.selectEntity(id)}
    />
  );
}

export const callGraphViewDescriptor: ViewDescriptor = {
  id: "call-graph",
  label: "Calls",
  glyph: "→",
  hint: "호출/임포트 그래프 — 전체 repo",
  tech: "file-edges × layered layout",
  usecase: "어디서 호출되고 어디로 호출하나 한눈에. IDE의 기본.",
  category: "deps",
  contexts: ["repo", "folder", "file"],
  needs: { graph: true },
  order: 100,
  capabilityKinds: ["view", "decision-input"],
  taxonomy: {
    primary: {
      domain: "se-refactor-change",
      scope: "repo",
      intent: "explore",
    },
    scopes: ["repo", "folder", "file"],
    intents: ["explore", "diagnose"],
    personas: ["developer", "reviewer", "tech-lead"],
    surfaces: ["view", "tab"],
    maturity: "core",
    signal: {
      dataFreshness: "snapshot",
      confidence: "measured",
      actionability: "explain",
      cost: "low",
      latency: "instant",
      determinism: "deterministic",
      evidenceLevel: "strong",
      decisionGrade: "informational",
    },
    domains: ["se-refactor-change", "productivity"],
    subdomain: "dependency-map",
    related: ["program-slice", "change-impact", "structure-outline"],
    keywords: ["call-graph", "import-graph", "dependency", "topology", "layout"],
  },
  decision: {
    grade: "informational",
    supports: ["refactor", "merge", "delegate"],
    evidenceClass: "strong",
  },
  actions: ["open-tab", "run-analysis", "compare-related"],
  workflow: {
    canBeAutoSuggested: true,
  },
  quality: {
    maturity: "core",
    owner: "platform",
  },
  Component: CallGraphModeView,
};
