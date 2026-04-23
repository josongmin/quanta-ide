// Dead-code view descriptor — list unreferenced files/symbols.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { DeadCodeView } from "./ui/DeadCodeView";

function DeadCodeModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree || !ctx.graph) return null;
  return (
    <DeadCodeView
      tree={ctx.tree}
      graph={ctx.graph}
      onFocusEntity={id => ctx.dispatch.selectEntity(id)}
      onDismiss={() => ctx.dispatch.selectEntity(null)}
    />
  );
}

export const deadCodeViewDescriptor: ViewDescriptor = {
  id: "dead-code",
  label: "Dead",
  glyph: "◯",
  hint: "참조 없는 죽은 코드",
  tech: "심볼 그래프 도달불가 분석",
  usecase: "즉시 지울 수 있는 코드 청소. 번들 다이어트.",
  category: "refactor",
  contexts: ["repo", "folder", "file"],
  needs: { tree: true, graph: true },
  order: 400,
  capabilityKinds: ["view", "decision-input", "workflow-step"],
  taxonomy: {
    primary: {
      domain: "se-refactor-change",
      scope: "folder",
      intent: "optimize",
    },
    scopes: ["folder", "repo", "file"],
    intents: ["optimize", "diagnose"],
    personas: ["developer", "reviewer", "tech-lead"],
    surfaces: ["view", "tab", "dashboard-card"],
    maturity: "core",
    signal: {
      dataFreshness: "snapshot",
      confidence: "measured",
      actionability: "triage",
      cost: "medium",
      latency: "interactive",
      determinism: "deterministic",
      evidenceLevel: "strong",
      decisionGrade: "advisory",
    },
    domains: ["se-refactor-change", "productivity"],
    subdomain: "dead-code-removal",
    related: ["dupe-clusters", "god-file", "hotspot"],
    keywords: ["dead-code", "unreferenced", "reachability", "bundle", "cleanup"],
  },
  decision: {
    grade: "advisory",
    supports: ["refactor", "merge"],
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
  Component: DeadCodeModeView,
};
