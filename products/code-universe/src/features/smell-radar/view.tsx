// Smell Radar view descriptor — multi-axis spider chart of repo smell profile.
// --------------------------------------------------------------------
// Aggregates `smellProfile(entity)` across all file entities, normalises
// each axis to 0..1, and renders a single polygon on a 6-axis radar.
// A "ghost" polygon (dashed) overlays last-week's synthesized profile so
// the user sees drift at a glance.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { SmellRadarView } from "./ui/SmellRadarView";

function SmellRadarModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
  return <SmellRadarView ctx={ctx} />;
}

export const smellRadarViewDescriptor: ViewDescriptor = {
  id: "smell-radar",
  label: "Smell",
  glyph: "⊛",
  hint: "코드 스멜 레이더",
  tech: "AST 패턴 스캐너 × 주간 집계",
  usecase: "전체 repo의 '건강 상태'를 한 차트로. 주간 트렌드.",
  category: "metrics",
  contexts: ["repo", "folder"],
  needs: { tree: true },
  order: 320,
  Component: SmellRadarModeView,
};
