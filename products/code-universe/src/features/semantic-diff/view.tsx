// Semantic Diff view — symbol-level diff between two commits.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { SemanticDiffView } from "./ui/SemanticDiffView";

function SemanticDiffModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return <SemanticDiffView ctx={ctx} />;
}

export const semanticDiffViewDescriptor: ViewDescriptor = {
  id: "semantic-diff",
  label: "Diff",
  glyph: "⇄",
  hint: "의미 단위 diff — 심볼 변화 버블"
,
  tech: "AST × git blame 교차 — add / remove / rename / move",
  usecase: "line diff 대신 '무엇이 추가됐고 옮겨갔는지' 시각화. 리뷰 속도 가속.",
  category: "history",
  contexts: ["repo", "folder"],
  needs: { tree: true },
  order: 700,
  Component: SemanticDiffModeView,
};
