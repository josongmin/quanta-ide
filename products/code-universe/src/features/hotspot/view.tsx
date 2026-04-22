// Hotspot view descriptor — churn × complexity bubble scatter.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { HotspotView } from "./ui/HotspotView";

function HotspotModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
  return <HotspotView ctx={ctx} />;
}

export const hotspotViewDescriptor: ViewDescriptor = {
  id: "hotspot",
  label: "Hotspot",
  glyph: "⚡",
  hint: "변경 빈도 × 복잡도 핫스팟",
  tech: "90일 churn + cyclomatic 스캔",
  usecase:
    "리팩터링 우선순위. 자주 터치되고 복잡한 파일이 테크부채 1번 후보.",
  category: "metrics",
  contexts: ["repo", "folder"],
  needs: { tree: true },
  order: 220,
  Component: HotspotModeView,
};
