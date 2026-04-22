// BudgetConsole view descriptor.
// --------------------------------------------------------------------
// Monthly AI spend governance — hero current-month / cap, 12mo
// history bar chart, category breakdown, top spenders, projection.
//
// Reference: FinOps framework; AWS / GCP billing dashboards;
// Anthropic Admin API cost tracking.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { BudgetConsoleView } from "./ui/BudgetConsoleView";

function BudgetConsoleModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
  return <BudgetConsoleView ctx={ctx} />;
}

export const budgetConsoleViewDescriptor: ViewDescriptor = {
  id: "budget-console",
  label: "Budget",
  glyph: "$",
  hint: "AI 예산 콘솔 — 월별 거버넌스",
  tech: "FinOps × 카테고리별 breakdown × 프로젝션",
  usecase: "AI 비용 통제. 초과 알림. 팀별 쿼터 관리.",
  category: "ai",
  contexts: ["repo"],
  needs: { tree: true },
  order: 990,
  Component: BudgetConsoleModeView,
};
