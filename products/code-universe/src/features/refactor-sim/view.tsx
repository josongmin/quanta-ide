// Refactor simulation view descriptor — what-if impact of a move.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { RefactorSimView } from "./ui/RefactorSimView";

function RefactorSimModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.graph) return null;
  return (
    <RefactorSimView
      graph={ctx.graph}
      onFocusEntity={id => {
        ctx.dispatch.selectEntity(id);
        ctx.dispatch.openMindMapOn(id);
        ctx.dispatch.setMode("mindmap");
      }}
      onDismiss={() => ctx.dispatch.selectEntity(null)}
    />
  );
}

export const refactorSimViewDescriptor: ViewDescriptor = {
  id: "refactor-sim",
  label: "Simulate",
  glyph: "⊕",
  hint: "리팩터링 시뮬레이션 — 예상 효과",
  tech: "의존성 그래프 변이 시뮬레이션",
  usecase:
    "실제 코드 건드리기 전 '이걸 분리하면 의존성이 어떻게 바뀌나' 확인. 팀에 리팩터링 제안할 때 before/after 근거 자료. 리스크 없는 사전 검증.",
  category: "refactor",
  contexts: ["repo", "folder", "file"],
  needs: { graph: true },
  order: 470,
  capabilityKinds: ["view", "decision-input", "workflow-step"],
  taxonomy: {
    primary: { domain: "se-refactor-change", scope: "file", intent: "decide" },
    scopes: ["repo", "file", "diff"],
    intents: ["decide", "verify", "optimize"],
    subdomain: "refactor-simulation",
    personas: ["developer", "reviewer", "tech-lead"],
    surfaces: ["view", "tab", "dashboard-card"],
    maturity: "advanced",
    signal: {
      dataFreshness: "snapshot",
      confidence: "estimated",
      actionability: "direct-action",
      cost: "medium",
      latency: "interactive",
      determinism: "bounded",
      evidenceLevel: "strong",
      decisionGrade: "advisory",
    },
    keywords: ["refactor", "simulate", "impact", "roi", "what-if"],
  },
  decision: {
    grade: "advisory",
    supports: ["refactor", "merge"],
    evidenceClass: "strong",
    failClosedEligible: false,
    humanReviewRequired: false,
  },
  actions: ["open-tab", "run-analysis", "compare-related"],
  workflow: {
    canBeAutoSuggested: true,
    canBeAutoAttached: true,
    requiresOrderedExecution: true,
  },
  quality: {
    maturity: "advanced",
    owner: "code-intel",
  },
  Component: RefactorSimModeView,
};
