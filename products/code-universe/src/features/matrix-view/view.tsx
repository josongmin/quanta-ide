// Matrix (DSM) view descriptor.

import { useMemo, type ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { MatrixView } from "./ui/MatrixView";
import { buildMatrixLayout } from "./model/build-matrix-layout";

function MatrixModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  const layout = useMemo(() => {
    if (!ctx.tree || !ctx.graph) return null;
    if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
    try {
      return buildMatrixLayout({
        tree: ctx.tree,
        graph: ctx.graph,
        width: ctx.viewportSize.w,
        height: ctx.viewportSize.h,
        // Package-level DSM at workspace scope — ~20-30 rows with clear
        // block structure. File-level DSM (rowKind: "building") only
        // makes sense when scoped into one package.
        rowKind: "galaxy",
        maxRows: 60,
      });
    } catch {
      return null;
    }
  }, [ctx.tree, ctx.graph, ctx.viewportSize.w, ctx.viewportSize.h]);

  if (!layout) return null;

  return (
    <MatrixView
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

export const matrixViewDescriptor: ViewDescriptor = {
  id: "matrix",
  label: "Matrix",
  glyph: "⊞",
  hint: "DSM — 의존성 격자 행렬",
  tech: "Design Structure Matrix",
  usecase:
    "의존 방향이 올바른지(상위→하위) 셀 단위로 검토. 순환 의존을 정확한 파일 쌍으로 찾기. 아키텍처 리뷰 미팅 자료.",
  category: "deps",
  contexts: ["repo", "folder"],
  needs: { tree: true, graph: true },
  order: 150,

  capabilityKinds:   [
    "view",
    "decision-input"
  ],
  taxonomy:   {
    "primary": {
      "domain": "se-architecture",
      "scope": "folder",
      "intent": "verify"
    },
    "scopes": [
      "repo",
      "folder",
      "package"
    ],
    "intents": [
      "verify",
      "diagnose"
    ],
    "subdomain": "design-structure-matrix",
    "personas": [
      "developer",
      "tech-lead",
      "platform"
    ],
    "surfaces": [
      "view",
      "tab",
      "dashboard-card"
    ],
    "maturity": "core",
    "signal": {
      "dataFreshness": "snapshot",
      "confidence": "measured",
      "actionability": "direct-action",
      "cost": "low",
      "latency": "interactive",
      "determinism": "deterministic",
      "evidenceLevel": "strong",
      "decisionGrade": "triage"
    },
    "related": [
      "chord",
      "pathfinder",
      "layer-audit"
    ],
    "keywords": [
      "matrix",
      "dsm",
      "dependency",
      "cell",
      "cycle"
    ]
  },
  decision:   {
    "grade": "triage",
    "supports": [
      "refactor",
      "policy-audit"
    ],
    "evidenceClass": "strong",
    "failClosedEligible": false,
    "humanReviewRequired": false
  },
  actions:   [
    "open-tab",
    "run-analysis",
    "compare-related"
  ],
  workflow:   {
    "canBeAutoSuggested": true,
    "canBeAutoAttached": false,
    "requiresOrderedExecution": false
  },
  quality:   {
    "maturity": "core",
    "owner": "architecture"
  },
  Component: MatrixModeView,
};
