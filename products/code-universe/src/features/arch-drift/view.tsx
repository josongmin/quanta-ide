// Architecture drift view descriptor — baseline → current delta.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { ArchDriftView } from "./ui/ArchDriftView";

function ArchDriftModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.graph) return null;
  return (
    <ArchDriftView
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

export const archDriftViewDescriptor: ViewDescriptor = {
  id: "arch-drift",
  label: "Drift",
  glyph: "∿",
  hint: "베이스라인 대비 아키텍처 변화",
  tech: "레이어 분류 스냅샷 diff",
  usecase:
    "릴리즈 이후 아키텍처가 얼마나 변했나 확인. 스프린트 종료 후 의도치 않은 구조 변화 감지. 아키텍처 거버넌스 리포트.",
  category: "history",
  contexts: ["repo"],
  needs: { graph: true },
  order: 780,

  capabilityKinds:   [
    "view",
    "decision-input"
  ],
  taxonomy:   {
    "primary": {
      "domain": "se-evolution",
      "scope": "repo",
      "intent": "diagnose"
    },
    "scopes": [
      "repo",
      "project",
      "module"
    ],
    "intents": [
      "diagnose",
      "verify"
    ],
    "subdomain": "architecture-drift",
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
      "confidence": "measured",
      "actionability": "triage",
      "cost": "medium",
      "latency": "interactive",
      "determinism": "bounded",
      "evidenceLevel": "strong",
      "decisionGrade": "triage"
    },
    "related": [
      "arch-layers",
      "cycle-genesis",
      "smell-history"
    ],
    "keywords": [
      "drift",
      "baseline",
      "architecture",
      "diff",
      "change"
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
    "maturity": "advanced",
    "owner": "architecture"
  },
  Component: ArchDriftModeView,
};
