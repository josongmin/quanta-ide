// Churn Sparkline view descriptor — per-file 90-day commit histogram grid.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { ChurnSparklineView } from "./ui/ChurnSparklineView";

function ChurnSparklineModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return <ChurnSparklineView ctx={ctx} />;
}

export const churnSparklineViewDescriptor: ViewDescriptor = {
  id: "churn-sparkline",
  label: "Churn",
  glyph: "⟰",
  hint: "파일별 90일 커밋 스파크라인",
  tech: "git log × 파일 × 시간 버킷",
  usecase: "'언제 터치됐나'를 파일 카드마다 일괄 표시. 정렬로 최근 바쁜 파일 스캔.",
  category: "history",
  contexts: ["repo", "folder"],
  needs: { tree: true },
  order: 690,
  capabilityKinds: ["view", "decision-input"],
  taxonomy: {
    primary: {
      domain: "se-evolution",
      scope: "file",
      intent: "diagnose",
    },
    scopes: ["repo", "folder", "file"],
    intents: ["diagnose", "explore"],
    subdomain: "commit-rhythm",
    personas: ["developer", "tech-lead"],
    surfaces: ["view", "tab", "dashboard-card"],
    maturity: "advanced",
    signal: {
      dataFreshness: "snapshot",
      confidence: "measured",
      actionability: "triage",
      cost: "low",
      latency: "interactive",
      determinism: "deterministic",
      evidenceLevel: "strong",
      decisionGrade: "triage",
    },
    related: ["timelapse", "heat-rainfall", "file-history"],
    keywords: ["churn", "sparkline", "commits", "90-day"],
  },
  decision: {
    grade: "triage",
    supports: ["refactor"],
    evidenceClass: "strong",
    failClosedEligible: false,
    humanReviewRequired: false,
  },
  actions: ["open-tab", "run-analysis", "compare-related"],
  workflow: {
    canBeAutoSuggested: true,
    canBeAutoAttached: false,
    requiresOrderedExecution: false,
  },
  quality: {
    maturity: "advanced",
    owner: "platform",
  },
  Component: ChurnSparklineModeView,
};
