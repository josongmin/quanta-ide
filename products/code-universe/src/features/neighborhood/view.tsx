// Neighborhood view descriptor — N-hop ego-network around selection.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { NeighborhoodView } from "./ui/NeighborhoodView";

function NeighborhoodModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.graph) return null;
  return (
    <NeighborhoodView
      graph={ctx.graph}
      selectedId={ctx.selectedId ?? undefined}
      onFocusEntity={id => {
        ctx.dispatch.selectEntity(id);
        ctx.dispatch.setMode("neighborhood");
      }}
      onDismiss={() => ctx.dispatch.selectEntity(null)}
    />
  );
}

export const neighborhoodViewDescriptor: ViewDescriptor = {
  id: "neighborhood",
  label: "Halo",
  glyph: "○",
  hint: "N-홉 이웃 관계 링",
  tech: "N-홉 의존성 그래프 탐색",
  usecase:
    "특정 파일의 직접/간접 이웃 파악. '이 파일 주변 생태계' 이해. 격리 리팩터링 전 영향 경계 설정.",
  category: "deps",
  contexts: ["folder", "file"],
  needs: { tree: true, graph: true, selection: true },
  order: 190,

  capabilityKinds:   [
    "view",
    "decision-input"
  ],
  taxonomy:   {
    "primary": {
      "domain": "explore",
      "scope": "file",
      "intent": "diagnose"
    },
    "scopes": [
      "file",
      "folder",
      "repo"
    ],
    "intents": [
      "diagnose",
      "explore"
    ],
    "subdomain": "n-hop-neighborhood",
    "personas": [
      "developer",
      "tech-lead",
      "platform"
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
      "mindmap",
      "pathfinder",
      "embedding"
    ],
    "keywords": [
      "neighborhood",
      "hop",
      "ring",
      "dependency",
      "radius"
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
  Component: NeighborhoodModeView,
};
