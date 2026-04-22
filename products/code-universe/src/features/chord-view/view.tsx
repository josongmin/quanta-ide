// Chord view descriptor — package-level dependency coupling ring.

import { useMemo, type ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { ChordView } from "./ui/ChordView";
import { buildChordLayout } from "./model/build-chord-layout";

function ChordModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  const layout = useMemo(() => {
    if (!ctx.tree || !ctx.graph) return null;
    if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
    try {
      return buildChordLayout({
        tree: ctx.tree,
        graph: ctx.graph,
        width: ctx.viewportSize.w,
        height: ctx.viewportSize.h,
        leafKind: "galaxy",
      });
    } catch {
      return null;
    }
  }, [ctx.tree, ctx.graph, ctx.viewportSize.w, ctx.viewportSize.h]);

  if (!layout) return null;

  return (
    <ChordView
      layout={layout}
      width={ctx.viewportSize.w}
      height={ctx.viewportSize.h}
      onFocusEntity={id => {
        ctx.dispatch.selectEntity(id);
        ctx.dispatch.openMindMapOn(id);
        ctx.dispatch.setMode("mindmap");
      }}
      onDismiss={() => ctx.dispatch.selectEntity(null)}
    />
  );
}

export const chordViewDescriptor: ViewDescriptor = {
  id: "chord",
  label: "Chord",
  glyph: "⬡",
  hint: "패키지 간 의존성 강도 시각화",
  tech: "패키지-레벨 의존성 집계",
  usecase:
    "패키지 간 결합도가 심한 곳 식별. 순환 의존 발생 위험 영역 조기 감지. 마이크로서비스 분리 전 경계 적합성 검토.",
  category: "deps",
  contexts: ["repo", "folder"],
  needs: { tree: true, graph: true },
  order: 140,
  Component: ChordModeView,
};
