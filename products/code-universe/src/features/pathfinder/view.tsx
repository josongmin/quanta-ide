// Pathfinder view descriptor — shortest dependency path between nodes.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { PathfinderView } from "./ui/PathfinderView";

function PathfinderModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.graph) return null;
  return (
    <PathfinderView
      graph={ctx.graph}
      selectedId={ctx.selectedId ?? undefined}
      onFocusEntity={id => {
        ctx.dispatch.selectEntity(id);
        ctx.dispatch.openMindMapOn(id);
        ctx.dispatch.setMode("mindmap");
      }}
      onDismiss={() => ctx.dispatch.selectEntity(null)}
    />
  );
}

export const pathfinderViewDescriptor: ViewDescriptor = {
  id: "pathfinder",
  label: "Path",
  glyph: "→",
  hint: "두 파일 사이 의존 경로 탐색",
  tech: "의존성 그래프 BFS 최단 경로",
  usecase:
    "'A가 B를 왜 알고 있지?' 의존 경로 추적. 의도치 않은 간접 의존 발견. 모듈 분리 시 끊어야 할 경로 확인.",
  category: "deps",
  contexts: ["file"],
  needs: { tree: true, graph: true, selection: true },
  order: 180,

  capabilityKinds:   [
    "view",
    "decision-input"
  ],
  taxonomy:   {
    "primary": {
      "domain": "se-architecture",
      "scope": "file",
      "intent": "explain"
    },
    "scopes": [
      "file",
      "folder",
      "repo"
    ],
    "intents": [
      "explain",
      "diagnose"
    ],
    "subdomain": "dependency-path",
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
      "confidence": "measured",
      "actionability": "explain",
      "cost": "low",
      "latency": "interactive",
      "determinism": "deterministic",
      "evidenceLevel": "strong",
      "decisionGrade": "advisory"
    },
    "related": [
      "mindmap",
      "neighborhood",
      "matrix"
    ],
    "keywords": [
      "path",
      "dependency",
      "bfs",
      "trace",
      "file"
    ]
  },
  decision:   {
    "grade": "advisory",
    "supports": [
      "refactor"
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
    "canBeAutoSuggested": false,
    "canBeAutoAttached": false,
    "requiresOrderedExecution": false
  },
  quality:   {
    "maturity": "core",
    "owner": "architecture"
  },
  Component: PathfinderModeView,
};
