// ContextWindowFit view descriptor — which files fit in which
// model context window (128K / 200K / 1M / 2M).
// --------------------------------------------------------------------
// Reference: Anthropic 200K/1M context docs (2025); Google Gemini 2.5
// Pro 2M window; Kamradt "Needle in a Haystack" long-context benchmarks.
// Novel 2026 lens — "context fit as a first-class model-selection axis."

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { ContextWindowFitView } from "./ui/ContextWindowFitView";

function ContextWindowFitModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return <ContextWindowFitView ctx={ctx} />;
}

export const contextWindowFitViewDescriptor: ViewDescriptor = {
  id: "context-window-fit",
  label: "ContextFit",
  glyph: "◯",
  hint: "컨텍스트 윈도우 적합성",
  tech: "파일 토큰 vs 128K/200K/1M/2M 한계",
  usecase: "어떤 파일이 어떤 모델에 fit하는가. 모델 선택 가이드.",
  category: "ai",
  contexts: ["repo"],
  needs: { tree: true },
  order: 740,
  Component: ContextWindowFitModeView,
};
