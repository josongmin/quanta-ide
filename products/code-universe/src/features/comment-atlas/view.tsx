// CommentAtlas view descriptor — density × quality map of comments.
// --------------------------------------------------------------------
// Split pane: left 60% folder-grid coloured by comment DENSITY, right
// 40% quality histogram + category breakdown (TODO / FIXME / docstring
// / deprecated / dead-code).
//
// Reference: Steidl et al. "Quality Analysis of Source Code Comments"
// (ICPC 2013); Padioleau et al.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { CommentAtlasView } from "./ui/CommentAtlasView";

function CommentAtlasModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
  return <CommentAtlasView ctx={ctx} />;
}

export const commentAtlasViewDescriptor: ViewDescriptor = {
  id: "comment-atlas",
  label: "Comments",
  glyph: "¶",
  hint: "주석 지도 — 밀도 × 품질",
  tech: "주석 라인 비율 × NLP 품질 분류",
  usecase: "'주석 많음=좋음' 거짓 반박. 저품질 TODO 밀집 지역 탐지.",
  category: "metrics",
  contexts: ["repo", "folder"],
  needs: { tree: true },
  order: 330,
  Component: CommentAtlasModeView,
};
