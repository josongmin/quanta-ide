// DevExHealth — developer experience + CI health descriptor.
// --------------------------------------------------------------------
// Six hero tiles: local build seconds, CI minutes per commit, CI queue
// minutes, flaky-test count, test-suite seconds, PR wait P50/P95.
// Each tile colors against a threshold (green/warn/danger) and draws a
// 12-week seeded sparkline. Weekly activity tile at the bottom includes
// build-success-rate gauge.
//
// References:
//   - Accelerate: The Science of Lean Software (Forsgren/Humble/Kim, 2018).
//   - DORA State of DevOps reports.
//   - SPACE: a framework for developer productivity (Forsgren, Storey,
//     Maddila, Zimmermann, Houck, Butler — CACM 2021).

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { DevExHealthView } from "./ui/DevExHealthView";

function DevExHealthModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return <DevExHealthView ctx={ctx} />;
}

export const devExHealthViewDescriptor: ViewDescriptor = {
  id: "devex-health",
  label: "DevEx",
  glyph: "◨",
  hint: "개발자 경험 + CI 건강",
  tech: "빌드시간 · CI 큐 · PR wait · SPACE framework",
  usecase: "팀 병목 진단. '왜 릴리즈가 느리지' 답. DORA 보완.",
  category: "quality",
  contexts: ["repo"],
  needs: { tree: true },
  order: 385,
  capabilityKinds: ["view", "decision-input", "workflow-step"],
  taxonomy: {
    primary: {
      domain: "productivity",
      scope: "team",
      intent: "optimize",
    },
    scopes: ["team", "repo"],
    intents: ["optimize", "govern"],
    personas: ["manager", "tech-lead", "developer"],
    surfaces: ["view", "tab", "dashboard-card"],
    maturity: "core",
    signal: {
      dataFreshness: "live",
      confidence: "measured",
      actionability: "direct-action",
      cost: "low",
      latency: "instant",
      determinism: "deterministic",
      evidenceLevel: "strong",
      decisionGrade: "informational",
    },
    domains: ["productivity", "se-ownership-team"],
    subdomain: "developer-experience",
    related: ["problems-panel", "review-heat", "ownership-sankey"],
    keywords: ["devex", "dora", "ci", "build", "pr-wait"],
  },
  decision: {
    grade: "advisory",
    supports: ["delegate", "policy-audit"],
    evidenceClass: "strong",
  },
  actions: ["open-tab", "run-analysis", "pin-dashboard", "attach-to-task-routing"],
  workflow: {
    canBeAutoSuggested: true,
    canBeAutoAttached: true,
  },
  quality: {
    maturity: "core",
    owner: "platform",
  },
  Component: DevExHealthModeView,
};
