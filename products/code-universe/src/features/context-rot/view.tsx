// ContextRot view descriptor — "Lost in the Middle" per-file decay map.
// --------------------------------------------------------------------
// Reference: Liu et al. "Lost in the Middle: How Language Models Use
// Long Contexts" TACL 2023; Kamradt "Needle in a Haystack" 2023;
// "Ruler" long-context benchmark 2024. Every long-context LLM shows a
// U-shape attention decay — tokens in the middle of the prompt lose
// accuracy vs the ends. This view reifies that decay per file so users
// can pick safe slots when stuffing context.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { ContextRotView } from "./ui/ContextRotView";

function ContextRotModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
  return <ContextRotView ctx={ctx} />;
}

export const contextRotViewDescriptor: ViewDescriptor = {
  id: "context-rot",
  label: "Rot",
  glyph: "◇",
  hint: "장기 컨텍스트 성능 감쇠 — Lost in the Middle",
  tech: "U-shape position bias 모델링 × 파일별 감도",
  usecase:
    "RAG/에이전트 컨텍스트 넣을 때 순서 최적화. 긴 컨텍스트 안에서 사라지는 파일 식별.",
  category: "ai",
  contexts: ["repo", "folder"],
  needs: { tree: true },
  order: 870,
  Component: ContextRotModeView,
};
