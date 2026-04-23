// Service topology view descriptor — package-level service topology.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { ServiceTopoView } from "./ui/ServiceTopoView";

function ServiceTopoModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.graph) return null;
  return (
    <ServiceTopoView
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

export const serviceTopoViewDescriptor: ViewDescriptor = {
  id: "service-topo",
  label: "Services",
  glyph: "⬢",
  hint: "패키지 간 서비스 토폴로지",
  tech: "모듈 경계 + 공개 API 의존성",
  usecase:
    "마이크로서비스 경계와 실제 코드 구조 일치 여부 확인. API 의존 방향이 설계 의도와 맞는지 검토. 서비스 분리/통합 계획 수립.",
  category: "arch",
  contexts: ["repo"],
  needs: { graph: true },
  order: 530,

  capabilityKinds:   [
    "view",
    "decision-input"
  ],
  taxonomy:   {
    "primary": {
      "domain": "se-architecture",
      "scope": "package",
      "intent": "explain"
    },
    "scopes": [
      "repo",
      "package",
      "module"
    ],
    "intents": [
      "explain",
      "diagnose"
    ],
    "subdomain": "service-boundaries",
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
      "actionability": "triage",
      "cost": "medium",
      "latency": "interactive",
      "determinism": "bounded",
      "evidenceLevel": "strong",
      "decisionGrade": "advisory"
    },
    "related": [
      "arch-layers",
      "matrix",
      "chord",
      "dependency-health"
    ],
    "keywords": [
      "service",
      "topology",
      "boundary",
      "api",
      "dependency"
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
    "canBeAutoSuggested": true,
    "canBeAutoAttached": false,
    "requiresOrderedExecution": false
  },
  quality:   {
    "maturity": "core",
    "owner": "architecture"
  },
  Component: ServiceTopoModeView,
};
