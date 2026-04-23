// God-file view descriptor — ranked list of oversized / multi-responsibility files.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { GodFileView } from "./ui/GodFileView";

function GodFileModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return (
    <GodFileView
      tree={ctx.tree}
      onFocusEntity={id => ctx.dispatch.selectEntity(id)}
      onDismiss={() => ctx.dispatch.selectEntity(null)}
    />
  );
}

export const godFileViewDescriptor: ViewDescriptor = {
  id: "god-file",
  label: "God",
  glyph: "◉",
  hint: "신(神)급 파일 — 너무 많은 책임",
  tech: "LoC + 응집도 클러스터링",
  usecase: "분리 리팩터링 후보. 한 파일에 도메인 2~3개.",
  category: "refactor",
  contexts: ["repo", "folder"],
  needs: { tree: true },
  order: 430,
  capabilityKinds: ["view", "decision-input", "workflow-step"],
  taxonomy: {
    primary: {
      domain: "se-refactor-change",
      scope: "folder",
      intent: "verify",
    },
    scopes: ["repo", "folder"],
    intents: ["diagnose", "optimize", "decide", "verify"],
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
    domains: ["se-refactor-change", "se-quality"],
    subdomain: "size-structure",
    related: ["dupe-clusters", "feature-envy", "hotspot"],
    keywords: ["god-file", "size", "responsibility", "cohesion", "split"],
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
  Component: GodFileModeView,
};
