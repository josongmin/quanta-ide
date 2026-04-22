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
  Component: ChurnSparklineModeView,
};
