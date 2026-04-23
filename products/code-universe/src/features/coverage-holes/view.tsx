// Coverage view descriptor — coverage-holes file heatmap.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { CoverageHolesView } from "./ui/CoverageHolesView";

function CoverageHolesModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
  return <CoverageHolesView ctx={ctx} />;
}

export const coverageHolesViewDescriptor: ViewDescriptor = {
  id: "coverage-holes",
  label: "Coverage",
  glyph: "◐",
  hint: "테스트 커버리지 구멍",
  tech: "커버리지 리포트 × 파일 트리",
  usecase: "테스트 안 걸린 핵심 파일 스캔.",
  category: "metrics",
  contexts: ["repo", "folder"],
  needs: { tree: true },
  order: 290,
  capabilityKinds: ["view", "decision-input"],
  taxonomy: {
    primary: {
      domain: "se-testing",
      scope: "repo",
      intent: "verify",
    },
    scopes: ["repo", "folder", "file"],
    intents: ["verify", "diagnose"],
    personas: ["developer", "reviewer", "tech-lead"],
    surfaces: ["view", "tab", "dashboard-card"],
    maturity: "core",
    signal: {
      dataFreshness: "snapshot",
      confidence: "measured",
      actionability: "direct-action",
      cost: "medium",
      latency: "interactive",
      determinism: "deterministic",
      evidenceLevel: "strong",
      decisionGrade: "advisory",
    },
    domains: ["se-testing", "se-quality"],
    subdomain: "coverage-gaps",
    related: ["mutation-score", "test-pyramid", "quality-gate"],
    keywords: ["coverage", "holes", "missing-tests", "risk", "gap"],
  },
  decision: {
    grade: "triage",
    supports: ["merge", "refactor"],
    evidenceClass: "strong",
  },
  actions: ["open-tab", "run-analysis", "compare-related", "pin-dashboard"],
  workflow: {
    canBeAutoSuggested: true,
  },
  quality: {
    maturity: "core",
    owner: "quality",
  },
  Component: CoverageHolesModeView,
};
