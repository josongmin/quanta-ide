// Cycle genesis view descriptor — when did each cycle first form.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { CycleGenesisView } from "./ui/CycleGenesisView";

function CycleGenesisModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.graph) return null;
  return (
    <CycleGenesisView
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

export const cycleGenesisViewDescriptor: ViewDescriptor = {
  id: "cycle-genesis",
  label: "Cycles↗",
  glyph: "↗",
  hint: "순환 의존이 처음 생긴 시점 타임라인",
  tech: "SCC + git blame 최초 등장 시점",
  usecase:
    "순환이 언제 처음 도입됐는지 커밋 단위 추적. 어떤 PR에서 순환이 생겼는지 책임 소재 파악. 재발 방지 가이드 작성 근거.",
  category: "history",
  contexts: ["repo"],
  needs: { graph: true },
  order: 760,
  capabilityKinds:   [
    "view",
    "decision-input",
    "policy-control"
  ],
  taxonomy:   {
    "primary": {
      "domain": "se-refactor-change",
      "scope": "repo",
      "intent": "diagnose"
    },
    "scopes": [
      "repo",
      "folder",
      "file"
    ],
    "intents": [
      "diagnose",
      "verify"
    ],
    "subdomain": "cycle-genesis",
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
      "cost": "low",
      "latency": "interactive",
      "determinism": "deterministic",
      "evidenceLevel": "strong",
      "decisionGrade": "triage"
    },
    "related": [
      "smell-history",
      "arch-drift",
      "temporal-coupling"
    ],
    "keywords": [
      "cycle",
      "genesis",
      "scc",
      "blame",
      "refactor"
    ]
  },
  decision:   {
    "grade": "triage",
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
    "compare-related",
    "attach-to-policy-check"
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
  Component: CycleGenesisModeView,
};
