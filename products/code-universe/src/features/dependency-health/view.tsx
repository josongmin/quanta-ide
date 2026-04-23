// DependencyHealth — supply-chain audit dashboard.
// --------------------------------------------------------------------
// Per-package view of top-level deps: current vs latest version,
// update kind (patch/minor/major), vulnerability counts colored by
// severity, license tag, install-size bar, weekly-download sparkline.
//
// Reference (industry practice):
//   - Dependabot (GitHub Advisory DB driven update alerts).
//   - Snyk Open Source (vuln + license scanning).
//   - Socket.dev (supply-chain risk scoring for npm).

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { DependencyHealthView } from "./ui/DependencyHealthView";

function DependencyHealthModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return <DependencyHealthView ctx={ctx} />;
}

export const dependencyHealthViewDescriptor: ViewDescriptor = {
  id: "dependency-health",
  label: "DepHealth",
  glyph: "⛂",
  hint: "의존성 건강 — version/update/vuln/license/size",
  tech: "package registry × npm audit × license scan",
  usecase: "supply chain 감사. critical vuln 0 달성 여부. '업데이트 할 것' 스캔.",
  category: "security",
  contexts: ["repo"],
  needs: { tree: true },
  order: 570,

  capabilityKinds:   [
    "view",
    "decision-input",
    "policy-control"
  ],
  taxonomy:   {
    "primary": {
      "domain": "se-quality",
      "scope": "package",
      "intent": "verify"
    },
    "scopes": [
      "repo",
      "package",
      "module"
    ],
    "intents": [
      "verify",
      "diagnose"
    ],
    "subdomain": "dependency-health",
    "personas": [
      "developer",
      "platform",
      "security"
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
      "cost": "medium",
      "latency": "interactive",
      "determinism": "deterministic",
      "evidenceLevel": "auditable",
      "decisionGrade": "triage"
    },
    "related": [
      "package-instability",
      "dep-fossil",
      "sbom"
    ],
    "keywords": [
      "dependency",
      "health",
      "vuln",
      "license",
      "update"
    ]
  },
  decision:   {
    "grade": "triage",
    "supports": [
      "policy-audit",
      "refactor"
    ],
    "evidenceClass": "auditable",
    "failClosedEligible": false,
    "humanReviewRequired": false
  },
  actions:   [
    "open-tab",
    "run-analysis",
    "compare-related",
    "pin-dashboard"
  ],
  workflow:   {
    "canBeAutoSuggested": true,
    "canBeAutoAttached": false,
    "requiresOrderedExecution": false
  },
  quality:   {
    "maturity": "core",
    "owner": "quality"
  },
  Component: DependencyHealthModeView,
};
