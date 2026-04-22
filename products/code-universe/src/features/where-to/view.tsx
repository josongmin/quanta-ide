// WhereTo view descriptor — "where should I put this?" folder heat search.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { WhereToView } from "./ui/WhereToView";

function WhereToModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return (
    <WhereToView
      tree={ctx.tree}
      selectedId={ctx.selectedId}
      onFocusEntity={id => ctx.dispatch.selectEntity(id)}
    />
  );
}

export const whereToViewDescriptor: ViewDescriptor = {
  id: "where-to",
  label: "Where?",
  glyph: "?",
  hint: "여기 추가하면 어디?",
  tech: "키워드 × 임베딩 (AST 요약 벡터)",
  usecase: "새 기능 위치 찾기. 온보딩된 주니어한테도 친절.",
  category: "explore",
  contexts: ["repo", "folder"],
  needs: { tree: true },
  order: 80,
  Component: WhereToModeView,
};
