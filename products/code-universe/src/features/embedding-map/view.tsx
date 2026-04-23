// Embedding map view descriptor — UMAP-style structural similarity.

import { useMemo, type ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { EmbeddingMapView } from "./ui/EmbeddingMapView";
import { buildEmbeddingLayout } from "./model/build-embedding-layout";

function EmbeddingModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  const layout = useMemo(() => {
    if (!ctx.tree || !ctx.graph) return null;
    if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
    try {
      return buildEmbeddingLayout({
        tree: ctx.tree,
        graph: ctx.graph,
        width: ctx.viewportSize.w,
        height: ctx.viewportSize.h,
      });
    } catch {
      return null;
    }
  }, [ctx.tree, ctx.graph, ctx.viewportSize.w, ctx.viewportSize.h]);

  if (!layout) return null;

  return (
    <EmbeddingMapView
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

export const embeddingViewDescriptor: ViewDescriptor = {
  id: "embedding",
  label: "Embed",
  glyph: "✦",
  hint: "구조적 유사도 기반 2D 배치",
  tech: "구조 유사도 행렬 → UMAP 투영",
  usecase:
    "비슷한 역할/구조를 가진 모듈 클러스터 발견. 혼자 동떨어진 파일('이게 왜 여기?') 이상 탐지. 모듈 통합/재구성 시 후보군 식별.",
  category: "explore",
  contexts: ["repo", "folder", "file"],
  needs: { tree: true, graph: true },
  order: 50,

  capabilityKinds:   [
    "view",
    "decision-input"
  ],
  taxonomy:   {
    "primary": {
      "domain": "explore",
      "scope": "folder",
      "intent": "diagnose"
    },
    "scopes": [
      "repo",
      "folder",
      "file"
    ],
    "intents": [
      "explore",
      "diagnose"
    ],
    "subdomain": "structural-embedding",
    "personas": [
      "developer",
      "tech-lead",
      "manager"
    ],
    "surfaces": [
      "view",
      "tab",
      "dashboard-card"
    ],
    "maturity": "advanced",
    "signal": {
      "dataFreshness": "snapshot",
      "confidence": "heuristic",
      "actionability": "explain",
      "cost": "medium",
      "latency": "interactive",
      "determinism": "heuristic",
      "evidenceLevel": "strong",
      "decisionGrade": "informational"
    },
    "related": [
      "galaxy-3d",
      "package-surface",
      "file-twins"
    ],
    "keywords": [
      "embedding",
      "clustering",
      "umap",
      "similarity",
      "layout"
    ]
  },
  decision:   {
    "grade": "informational",
    "supports": [],
    "evidenceClass": "strong",
    "failClosedEligible": false,
    "humanReviewRequired": false
  },
  actions:   [
    "open-tab",
    "open-view",
    "compare-related"
  ],
  workflow:   {
    "canBeAutoSuggested": false,
    "canBeAutoAttached": false,
    "requiresOrderedExecution": false
  },
  quality:   {
    "maturity": "advanced",
    "owner": "code-intel"
  },
  Component: EmbeddingModeView,
};
