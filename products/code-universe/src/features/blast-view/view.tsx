// Blast radius view descriptor — concentric rings of transitive impact.
// Owns its own `direction` state (blast ⇄ fix) via useState so the
// toggle lives with the view and doesn't leak into the shell.

import { useMemo, useState, type ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { BlastView } from "./ui/BlastView";
import { buildBlastLayout } from "./model/build-blast-layout";
import type { BlastDirection } from "./model/types";

function BlastModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  const [direction, setDirection] = useState<BlastDirection>("blast");

  const layout = useMemo(() => {
    if (!ctx.tree || !ctx.graph) return null;
    if (!ctx.selectedId) return null;
    if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
    try {
      return buildBlastLayout({
        tree: ctx.tree,
        graph: ctx.graph,
        width: ctx.viewportSize.w,
        height: ctx.viewportSize.h,
        centerId: ctx.selectedId,
        direction,
      });
    } catch {
      return null;
    }
  }, [ctx.tree, ctx.graph, ctx.selectedId, direction, ctx.viewportSize.w, ctx.viewportSize.h]);

  if (!layout) return null;

  return (
    <BlastView
      layout={layout}
      width={ctx.viewportSize.w}
      height={ctx.viewportSize.h}
      onFocusEntity={id => {
        ctx.dispatch.selectEntity(id);
        ctx.dispatch.openMindMapOn(id);
        ctx.dispatch.setMode("mindmap");
      }}
      onToggleDirection={() => setDirection(d => (d === "blast" ? "fix" : "blast"))}
      onDismiss={() => ctx.dispatch.selectEntity(null)}
    />
  );
}

export const blastViewDescriptor: ViewDescriptor = {
  id: "blast",
  label: "Blast",
  glyph: "⚡",
  hint: "선택 파일의 변경 영향 범위",
  tech: "역방향 전이 의존성 BFS",
  usecase:
    "'이 파일 바꾸면 뭐가 깨지나' 즉시 확인. 핫픽스 전 영향 범위 검토. 테스트 범위 결정(어느 테스트까지 돌려야 하나).",
  category: "deps",
  contexts: ["folder", "file"],
  needs: { tree: true, graph: true, selection: true },
  order: 170,
  capabilityKinds: ["view", "decision-input", "workflow-step"],
  taxonomy: {
    primary: { domain: "se-refactor-change", scope: "diff", intent: "decide" },
    scopes: ["repo", "file", "diff"],
    intents: ["verify", "decide", "diagnose"],
    subdomain: "blast-radius",
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
    keywords: ["blast", "impact", "dependency", "change", "scope"],
  },
  decision: {
    grade: "advisory",
    supports: ["merge", "refactor"],
    evidenceClass: "strong",
    failClosedEligible: false,
    humanReviewRequired: false,
  },
  actions: ["open-tab", "run-analysis", "attach-to-pr-review", "compare-related"],
  workflow: {
    canBeAutoSuggested: true,
    canBeAutoAttached: true,
    requiresOrderedExecution: false,
  },
  quality: {
    maturity: "core",
    owner: "code-intel",
  },
  Component: BlastModeView,
};
