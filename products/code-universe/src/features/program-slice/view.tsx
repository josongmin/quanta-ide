// ProgramSlice view descriptor — backward/forward program slicing.
// Reference: Weiser TSE 1981, "Program Slicing". CodeSurfer.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { ProgramSliceView } from "./ui/ProgramSliceView";

function ProgramSliceModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.graph) return null;
  return (
    <ProgramSliceView
      graph={ctx.graph}
      tree={ctx.tree}
      selectedId={ctx.selectedId}
      width={ctx.viewportSize.w}
      height={ctx.viewportSize.h}
      onFocusEntity={id => ctx.dispatch.selectEntity(id)}
    />
  );
}

export const programSliceViewDescriptor: ViewDescriptor = {
  id: "program-slice",
  label: "Slice",
  glyph: "⋔",
  hint: "프로그램 슬라이스 — 영향 역추적",
  tech: "데이터플로우 역/정방향 도달 분석",
  usecase: "버그 수정 시 '이 값 어디서 왔나/어디로 가나' 정확히.",
  category: "deps",
  contexts: ["file", "folder", "repo"],
  needs: { graph: true, selection: true },
  order: 120,
  capabilityKinds: ["view", "decision-input", "workflow-step"],
  taxonomy: {
    primary: {
      domain: "se-refactor-change",
      scope: "repo",
      intent: "verify",
    },
    scopes: ["repo", "folder", "file"],
    intents: ["verify", "diagnose"],
    personas: ["developer", "reviewer", "tech-lead"],
    surfaces: ["view", "tab"],
    maturity: "advanced",
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
    domains: ["se-refactor-change", "se-testing"],
    subdomain: "program-slicing",
    related: ["change-impact", "call-graph", "control-flow"],
    keywords: ["slice", "dataflow", "dependence", "trace", "impact"],
  },
  decision: {
    grade: "advisory",
    supports: ["refactor", "merge", "delegate"],
    evidenceClass: "strong",
  },
  actions: ["open-tab", "run-analysis", "compare-related", "attach-to-pr-review"],
  workflow: {
    canBeAutoSuggested: true,
    canBeAutoAttached: true,
  },
  quality: {
    maturity: "advanced",
    owner: "platform",
  },
  Component: ProgramSliceModeView,
};
