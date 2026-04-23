// Evolution DNA view descriptor — commit-wise per-function strand.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { EvolutionDnaView } from "./ui/EvolutionDnaView";

function EvolutionDnaModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return <EvolutionDnaView ctx={ctx} />;
}

export const evolutionDnaViewDescriptor: ViewDescriptor = {
  id: "evolution-dna",
  label: "DNA",
  glyph: "⫶",
  hint: "파일의 유전자 서열 — 커밋별 함수 진화",
  tech: "AST × git blame diff",
  usecase: "파일이 어떻게 진화했는지 역사 추적. 시연 임팩트 큼.",
  category: "history",
  contexts: ["file"],
  needs: { tree: true, selection: true },
  order: 680,
  capabilityKinds:   [
    "view",
    "decision-input"
  ],
  taxonomy:   {
    "primary": {
      "domain": "se-evolution",
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
    "subdomain": "file-evolution-dna",
    "personas": [
      "developer",
      "reviewer",
      "tech-lead"
    ],
    "surfaces": [
      "view",
      "tab"
    ],
    "maturity": "advanced",
    "signal": {
      "dataFreshness": "snapshot",
      "confidence": "measured",
      "actionability": "explain",
      "cost": "medium",
      "latency": "interactive",
      "determinism": "bounded",
      "evidenceLevel": "strong",
      "decisionGrade": "advisory"
    },
    "related": [
      "blame-clock",
      "smell-history",
      "temporal-coupling"
    ],
    "keywords": [
      "dna",
      "blame",
      "commit",
      "evolution",
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
    "maturity": "advanced",
    "owner": "code-intel"
  },
  Component: EvolutionDnaModeView,
};
