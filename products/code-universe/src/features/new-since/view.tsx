// NewSince view descriptor — files touched since a chosen date.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { NewSinceView } from "./ui/NewSinceView";

function NewSinceModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return <NewSinceView ctx={ctx} />;
}

export const newSinceViewDescriptor: ViewDescriptor = {
  id: "new-since",
  label: "Since",
  glyph: "✦",
  hint: "이 시점 이후 바뀐 파일",
  tech: "git log 필터 × 파일 트리",
  usecase: "코드리뷰 온보딩. '지난 스프린트에 뭐가 바뀌었지' 스캔.",
  category: "history",
  contexts: ["repo", "folder"],
  needs: { tree: true },
  order: 660,
  Component: NewSinceModeView,
};
