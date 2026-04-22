// Debt Ratio view — Sonar SQALE Technical Debt Ratio dashboard.
// Remediation cost / development cost with A-E rating tiers.
// Reference: SonarSource SQALE model; dev cost = 0.06d per LoC.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { DebtRatioView } from "./ui/DebtRatioView";

function DebtRatioModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return <DebtRatioView ctx={ctx} />;
}

export const debtRatioViewDescriptor: ViewDescriptor = {
  id: "debt-ratio",
  label: "Debt%",
  glyph: "▲",
  hint: "기술 부채 비율 — Sonar SQALE",
  tech: "debt hours / dev cost (0.06d per LoC) → A-E",
  usecase: "현재 부채 비율 한 숫자로. 릴리즈 게이트 (≤5% A) 달성 여부 체크.",
  category: "quality",
  contexts: ["repo"],
  needs: { tree: true },
  order: 370,
  Component: DebtRatioModeView,
};
