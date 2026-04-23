// Blame Clock view descriptor — circular "clock face" of authors × age.
// --------------------------------------------------------------------
// Each tick = one file (top-N by LoC). Radial distance from centre
// encodes age; tick hue encodes primary author. A smooth second-hand
// sweeps once every 24s so the panel reads as a live instrument.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { BlameClockView } from "./ui/BlameClockView";

function BlameClockModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
  return <BlameClockView ctx={ctx} />;
}

export const blameClockViewDescriptor: ViewDescriptor = {
  id: "blame-clock",
  label: "Clock",
  glyph: "◷",
  hint: "블레임 클럭 — 저자 × 나이 원형",
  tech: "git blame × 작성일 방사형 매핑",
  usecase: "도메인 오너십과 시대성을 한 눈에.",
  category: "history",
  contexts: ["repo", "folder"],
  needs: { tree: true },
  order: 800,
  capabilityKinds:   [
    "view",
    "decision-input"
  ],
  taxonomy:   {
    "primary": {
      "domain": "se-ownership-team",
      "scope": "repo",
      "intent": "explain"
    },
    "scopes": [
      "repo",
      "folder",
      "file"
    ],
    "intents": [
      "explain",
      "diagnose"
    ],
    "subdomain": "ownership-clock",
    "personas": [
      "developer",
      "manager",
      "tech-lead"
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
      "actionability": "explain",
      "cost": "low",
      "latency": "interactive",
      "determinism": "deterministic",
      "evidenceLevel": "strong",
      "decisionGrade": "informational"
    },
    "related": [
      "evolution-dna",
      "heat-rainfall",
      "temporal-coupling"
    ],
    "keywords": [
      "blame",
      "clock",
      "author",
      "age",
      "ownership"
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
    "owner": "ownership"
  },
  Component: BlameClockModeView,
};
