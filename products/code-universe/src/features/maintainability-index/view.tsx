// Maintainability Index view descriptor — Oman & Hagemeister 1992 (MS formula).

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { MaintainabilityIndexView } from "./ui/MaintainabilityIndexView";

function MaintainabilityIndexModeView({
  ctx,
}: {
  ctx: ViewContextValue;
}): ReactElement | null {
  if (!ctx.tree) return null;
  if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
  return <MaintainabilityIndexView ctx={ctx} />;
}

export const maintainabilityIndexViewDescriptor: ViewDescriptor = {
  id: "maintainability-index",
  label: "MI",
  glyph: "◉",
  hint: "Maintainability Index — 헬스 스코어",
  tech: "171 - 5.2·ln(V) - 0.23·CC - 16.2·ln(LoC)",
  usecase:
    "전체 repo 건강도 단일 수치. 임원/PM 보고용. VS/MS 표준.",
  category: "metrics",
  contexts: ["repo", "folder"],
  needs: { tree: true },
  order: 270,
  Component: MaintainabilityIndexModeView,
};
