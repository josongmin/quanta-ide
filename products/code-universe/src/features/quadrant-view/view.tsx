// Quadrant view descriptor — churn × risk scatter.

import { useMemo, type ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { QuadrantView } from "./ui/QuadrantView";
import { buildQuadrantLayout } from "./model/build-quadrant-layout";

function QuadrantModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  const layout = useMemo(() => {
    if (!ctx.tree || !ctx.graph) return null;
    if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
    try {
      return buildQuadrantLayout({
        tree: ctx.tree,
        graph: ctx.graph,
        width: ctx.viewportSize.w,
        height: ctx.viewportSize.h,
        pointKind: "galaxy",
      });
    } catch {
      return null;
    }
  }, [ctx.tree, ctx.graph, ctx.viewportSize.w, ctx.viewportSize.h]);

  if (!layout) return null;

  return (
    <QuadrantView
      layout={layout}
      width={ctx.viewportSize.w}
      height={ctx.viewportSize.h}
      onFocusEntity={id => {
        ctx.dispatch.selectEntity(id);
        ctx.dispatch.openMindMapOn(id);
        ctx.dispatch.setMode("mindmap");
      }}
      onDismiss={() => ctx.dispatch.selectEntity(null)}
    />
  );
}

export const quadrantViewDescriptor: ViewDescriptor = {
  id: "quadrant",
  label: "Quad",
  glyph: "✕",
  hint: "변경 빈도 × 위험도 산점도",
  tech: "git churn × 순환 복잡도(CC)",
  usecase:
    "'자주 바뀌면서 복잡한' 파일 = 리팩터링 1순위. 스프린트 계획 시 기술 부채 우선순위 정량화. 안정 파일 vs 위험 파일 분류.",
  category: "metrics",
  contexts: ["repo", "folder"],
  needs: { tree: true, graph: true },
  order: 210,
  capabilityKinds: ["view", "decision-input"],
  taxonomy: {
    primary: { domain: "se-quality", scope: "file", intent: "decide" },
    scopes: ["repo", "folder", "file"],
    intents: ["decide", "diagnose", "optimize"],
    subdomain: "risk-prioritization",
    personas: ["developer", "reviewer", "tech-lead"],
    surfaces: ["view", "tab", "dashboard-card"],
    maturity: "core",
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
    keywords: ["quadrant", "risk", "churn", "complexity", "priority"],
  },
  decision: {
    grade: "advisory",
    supports: ["refactor", "escalate-review"],
    evidenceClass: "strong",
    failClosedEligible: false,
    humanReviewRequired: false,
  },
  actions: ["open-tab", "run-analysis", "pin-dashboard"],
  workflow: {
    canBeAutoSuggested: true,
    canBeAutoAttached: false,
    requiresOrderedExecution: false,
  },
  quality: {
    maturity: "core",
    owner: "code-intel",
  },
  Component: QuadrantModeView,
};
