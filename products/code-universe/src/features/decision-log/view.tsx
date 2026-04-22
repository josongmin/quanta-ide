// DecisionLog view descriptor — Architectural Decision Records viewer.
// Reference: Michael Nygard, "Documenting Architecture Decisions"
// (Relevance, 2011); MADR — Markdown Architecture Decision Records.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { DecisionLogView } from "./ui/DecisionLogView";

function DecisionLogModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return <DecisionLogView ctx={ctx} />;
}

export const decisionLogViewDescriptor: ViewDescriptor = {
  id: "decision-log",
  label: "ADR",
  glyph: "⌘",
  hint: "아키 결정 로그 — ADR",
  tech: "Nygard ADR 2011 × MADR 포맷",
  usecase: "과거 결정 문서화. 에이전트가 이 규칙들을 준수하도록 컨텍스트.",
  category: "ai",
  contexts: ["repo"],
  needs: { tree: true },
  order: 950,
  Component: DecisionLogModeView,
};
