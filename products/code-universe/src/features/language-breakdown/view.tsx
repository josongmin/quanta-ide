// LanguageBreakdown view descriptor — GitHub-style repo language mix.
// --------------------------------------------------------------------
// References:
//   - GitHub repository language bar (horizontal stacked bar + legend).
//   - GitHub Linguist — file-extension → language classifier.
// Applied here: LoC-weighted language share with a ranked "top files"
// list per language for onboarding tour-guidance.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { LanguageBreakdownView } from "./ui/LanguageBreakdownView";

function LanguageBreakdownModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return <LanguageBreakdownView ctx={ctx} />;
}

export const languageBreakdownViewDescriptor: ViewDescriptor = {
  id: "language-breakdown",
  label: "Langs",
  glyph: "⌬",
  hint: "언어 분포 — repo 내 LoC 비율",
  tech: "파일 확장자 × LoC 집계",
  usecase: "polyglot repo의 언어 구성 한 눈에. 온보딩용.",
  category: "metrics",
  contexts: ["repo"],
  needs: { tree: true },
  order: 347,
  Component: LanguageBreakdownModeView,
};
