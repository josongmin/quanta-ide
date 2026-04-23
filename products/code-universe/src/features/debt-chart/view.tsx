// Debt chart view descriptor — time-series of technical-debt metrics.

import { useMemo, type ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { DebtChartView } from "./ui/DebtChartView";
import { buildDebtChartLayout } from "./model/build-debt-chart-layout";

function DebtChartModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  const layout = useMemo(() => {
    if (!ctx.graph) return null;
    if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
    try {
      return buildDebtChartLayout({
        graph: ctx.graph,
        width: ctx.viewportSize.w,
        height: ctx.viewportSize.h,
      });
    } catch {
      return null;
    }
  }, [ctx.graph, ctx.viewportSize.w, ctx.viewportSize.h]);

  if (!layout) return null;

  return (
    <DebtChartView
      layout={layout}
      width={ctx.viewportSize.w}
      height={ctx.viewportSize.h}
      onDismiss={() => ctx.dispatch.selectEntity(null)}
    />
  );
}

export const debtChartViewDescriptor: ViewDescriptor = {
  id: "debt-history",
  label: "Debt",
  glyph: "▲",
  hint: "기술 부채 누적 추이",
  tech: "순환 복잡도 + 부채 메트릭 × git 이력",
  usecase:
    "부채가 언제부터 쌓이기 시작했는지 타임라인 파악. 특정 시기 급증 원인 추적(어떤 PR/스프린트). 분기 회고 자료.",
  category: "quality",
  contexts: ["repo"],
  needs: { graph: true },
  order: 380,
  capabilityKinds: ["view", "decision-input"],
  taxonomy: {
    primary: {
      domain: "se-quality",
      scope: "repo",
      intent: "govern",
    },
    scopes: ["repo"],
    intents: ["diagnose", "govern", "decide"],
    subdomain: "debt-timeline",
    personas: ["manager", "tech-lead"],
    surfaces: ["view", "tab", "dashboard-card"],
    maturity: "advanced",
    signal: {
      dataFreshness: "snapshot",
      confidence: "estimated",
      actionability: "triage",
      cost: "low",
      latency: "interactive",
      determinism: "bounded",
      evidenceLevel: "strong",
      decisionGrade: "triage",
    },
    related: ["quality-gate", "debt-ratio", "dora-metrics"],
    keywords: ["debt", "history", "timeline", "trend"],
  },
  decision: {
    grade: "triage",
    supports: ["refactor", "policy-audit"],
    evidenceClass: "strong",
    failClosedEligible: false,
    humanReviewRequired: true,
  },
  actions: ["open-tab", "pin-dashboard", "compare-related"],
  workflow: {
    canBeAutoSuggested: true,
    canBeAutoAttached: false,
    requiresOrderedExecution: false,
  },
  quality: {
    maturity: "advanced",
    owner: "platform",
  },
  Component: DebtChartModeView,
};
