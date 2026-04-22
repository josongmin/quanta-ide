// XRayHotspot view descriptor — function-level hotspot drill for one file.
// --------------------------------------------------------------------
// Reference: Adam Tornhill, "Your Code as a Crime Scene" (Pragmatic,
// 2015); CodeScene X-Ray feature — after picking a hot file, decompose
// its heat across its internal functions.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { XRayHotspotView } from "./ui/XRayHotspotView";

function XRayHotspotModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  const entity = ctx.selectedId ? ctx.tree.byId.get(ctx.selectedId) : null;
  if (!entity || (entity.kind !== "building" && entity.kind !== "floor")) {
    return <XRayHotspotView empty />;
  }
  return <XRayHotspotView ctx={ctx} entity={entity} />;
}

export const xRayHotspotViewDescriptor: ViewDescriptor = {
  id: "xray-hotspot",
  label: "X-Ray",
  glyph: "◉",
  hint: "X-Ray — 파일 내부 함수별 핫스팟",
  tech: "파일 churn × 심볼 복잡도 분해",
  usecase: "핫파일 선택 후 실제 위험 함수 정확히 짚기. 리팩터 목표 좁히기.",
  category: "metrics",
  contexts: ["file"],
  needs: { tree: true, selection: true },
  order: 346,
  Component: XRayHotspotModeView,
};
