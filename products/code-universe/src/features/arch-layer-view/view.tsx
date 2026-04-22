// Architecture layer view descriptor — Sankey-style layer flow.

import { useMemo, type ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { ArchLayerView } from "./ui/ArchLayerView";
import { buildArchLayerLayout } from "./model/build-arch-layer-layout";

function ArchLayerModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  const layout = useMemo(() => {
    if (!ctx.graph) return null;
    if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
    try {
      return buildArchLayerLayout({
        graph: ctx.graph,
        width: ctx.viewportSize.w,
        height: ctx.viewportSize.h,
      });
    } catch {
      return null;
    }
  }, [ctx.graph, ctx.viewportSize.w, ctx.viewportSize.h]);

  if (!layout) return null;

  return (
    <ArchLayerView
      layout={layout}
      width={ctx.viewportSize.w}
      height={ctx.viewportSize.h}
      onDismiss={() => ctx.dispatch.selectEntity(null)}
    />
  );
}

export const archLayerViewDescriptor: ViewDescriptor = {
  id: "arch-layers",
  label: "Layers",
  glyph: "≡",
  hint: "아키텍처 레이어 간 의존 흐름",
  tech: "레이어 분류 + 의존 방향 위반 감지",
  usecase:
    "레이어 위반(하위가 상위를 import) 감지. FSD/클린 아키텍처 준수 여부 모니터링. 신규 파일 추가 시 레이어 배치 검증.",
  category: "arch",
  contexts: ["repo"],
  needs: { graph: true },
  order: 500,
  Component: ArchLayerModeView,
};
