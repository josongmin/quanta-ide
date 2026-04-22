// Quality Gate view — Sonar-style executive pass/fail dashboard.
// Reference: SonarSource "Quality Gate" — combines Reliability / Security
// / Maintainability ratings A-E + Coverage / Duplication / Debt Ratio
// against configured thresholds.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { QualityGateView } from "./ui/QualityGateView";

function QualityGateModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return <QualityGateView ctx={ctx} />;
}

export const qualityGateViewDescriptor: ViewDescriptor = {
  id: "quality-gate",
  label: "Gate",
  glyph: "✓",
  hint: "Sonar식 Quality Gate — 핵심 지표 합격/불합격",
  tech: "Reliability/Security/Maintainability A-E × 커버리지 × 중복 × 부채 비율",
  usecase: "임원/PM 주간 보고. 핵심 품질 지표 한 화면. 릴리즈 게이트 체크.",
  category: "quality",
  contexts: ["repo"],
  needs: { tree: true },
  order: 350,
  Component: QualityGateModeView,
};
