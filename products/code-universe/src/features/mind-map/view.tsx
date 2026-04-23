// Mind-map view descriptor — egocentric radial relationship graph.
// --------------------------------------------------------------------
// Centre is the currently-selected entity (or root as fallback). The
// overlay's presence is driven by `mindMapStore.enabled`; the view-mode
// store tracks the user's intent (mode === "mindmap"). The descriptor's
// onActivate/onDeactivate keep the two in sync so cross-view pivots
// and keyboard shortcuts flow through one contract.

import { useEffect, useMemo, type ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { entityStore } from "../../entities/entity";
import { MindMapView } from "./ui/MindMapView";
import { buildMindMap } from "./model/build-mind-map";
import { mindMapStore, useMindMapState } from "./model/store";

function MindMapModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  const enabled = useMindMapState(s => s.enabled);
  const centerId = useMindMapState(s => s.centerId);

  // Sync centre with external selection — Explorer clicks, breadcrumbs,
  // keyboard nav, and any other source that updates `selectedId` must
  // re-centre the mindmap. Without this, only in-mindmap clicks move
  // the centre and external selection looks broken. The self-emitted
  // case (mindmap click → dispatch.selectEntity → this fires) is a
  // no-op because openOn short-circuits when the id already matches.
  useEffect(() => {
    if (!enabled) return;
    const next = ctx.selectedId;
    if (next && next !== centerId) {
      mindMapStore.openOn(next);
    }
  }, [enabled, ctx.selectedId, centerId]);

  const graph = useMemo(() => {
    if (!enabled || !centerId) return null;
    if (!ctx.tree || !ctx.graph) return null;
    if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
    try {
      return buildMindMap({
        tree: ctx.tree,
        graph: ctx.graph,
        centerId,
        width: ctx.viewportSize.w,
        height: ctx.viewportSize.h,
      });
    } catch {
      // Centre id no longer in the tree (e.g. workspace reload) — close
      // the view instead of hanging on an invalid graph.
      mindMapStore.close();
      return null;
    }
  }, [enabled, centerId, ctx.tree, ctx.graph, ctx.viewportSize.w, ctx.viewportSize.h]);

  if (!enabled || !graph) return null;

  return (
    <MindMapView
      graph={graph}
      width={ctx.viewportSize.w}
      height={ctx.viewportSize.h}
      onFocusEntity={id => {
        // Mind-map re-center is semantically a drill-in (same as an
        // Explorer row click): commit the anchor AND move selection so
        // the Explorer reveals the new file's ancestor chain and the
        // Inspector swaps with it. `selectEntity` alone only moves the
        // selection — the LeftPanel reveals off `anchorId ?? selectedId`,
        // so a stale anchor would keep the tree pointing at the old file.
        entityStore.setAnchor(id);
        mindMapStore.openOn(id);
      }}
    />
  );
}

export const mindMapViewDescriptor: ViewDescriptor = {
  id: "mindmap",
  label: "Mind",
  glyph: "✸",
  hint: "선택 파일 중심의 방사형 관계도",
  tech: "AST 심볼 의존성 그래프",
  usecase:
    "파일 수정 전 '이게 뭘 쓰고 뭐한테 쓰이나' 즉시 파악. 의존성 체인 따라가기. 리팩터링 전 영향 범위 1차 확인.",
  category: "explore",
  contexts: ["repo", "folder", "file"],
  needs: { tree: true, graph: true },
  order: 40,
  onActivate(ctx) {
    // Always open on *something* — empty mind-maps read as a bug even
    // when they're technically correct. Prefer selection → anchor → root.
    const target = ctx.selectedId ?? ctx.anchorId ?? ctx.tree?.rootId ?? null;
    if (target) mindMapStore.openOn(target);
  },
  onDeactivate() {
    mindMapStore.close();
  },
  capabilityKinds:   [
    "view",
    "decision-input"
  ],
  taxonomy:   {
    "primary": {
      "domain": "explore",
      "scope": "file",
      "intent": "explain"
    },
    "scopes": [
      "repo",
      "folder",
      "file"
    ],
    "intents": [
      "explain",
      "explore"
    ],
    "subdomain": "symbol-neighborhood",
    "personas": [
      "developer",
      "tech-lead"
    ],
    "surfaces": [
      "view",
      "tab"
    ],
    "maturity": "core",
    "signal": {
      "dataFreshness": "snapshot",
      "confidence": "heuristic",
      "actionability": "explain",
      "cost": "low",
      "latency": "interactive",
      "determinism": "heuristic",
      "evidenceLevel": "strong",
      "decisionGrade": "informational"
    },
    "related": [
      "pathfinder",
      "neighborhood",
      "symbol-card"
    ],
    "keywords": [
      "mind",
      "map",
      "symbol",
      "call",
      "dependency"
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
    "maturity": "core",
    "owner": "platform"
  },
  Component: MindMapModeView,
};
