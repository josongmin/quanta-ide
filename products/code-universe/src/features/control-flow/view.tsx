// ControlFlow view descriptor — per-function basic-block CFG.
// Reference: Allen CACM 1970, "Control Flow Analysis". Compilers
// textbook standard since.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { ControlFlowView } from "./ui/ControlFlowView";

function ControlFlowModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  return (
    <ControlFlowView
      tree={ctx.tree}
      selectedId={ctx.selectedId}
      width={ctx.viewportSize.w}
      height={ctx.viewportSize.h}
    />
  );
}

export const controlFlowViewDescriptor: ViewDescriptor = {
  id: "control-flow",
  label: "CFG",
  glyph: "⑂",
  hint: "함수 제어흐름 그래프",
  tech: "AST basic-block 분석",
  usecase: "복잡한 함수의 내부 구조 시각화. 리팩터 전 cognitive load 측정.",
  category: "deps",
  contexts: ["file", "folder", "repo"],
  order: 110,
  capabilityKinds: ["view", "decision-input"],
  taxonomy: {
    primary: {
      domain: "se-refactor-change",
      scope: "file",
      intent: "explain",
    },
    scopes: ["file", "folder"],
    intents: ["explain", "diagnose"],
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
    domains: ["se-refactor-change", "se-quality"],
    subdomain: "function-structure",
    related: ["program-slice", "structure-outline", "cognitive-complexity"],
    keywords: ["cfg", "control-flow", "basic-block", "branch", "compiler"],
  },
  decision: {
    grade: "informational",
    supports: ["refactor", "merge"],
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
  Component: ControlFlowModeView,
};
