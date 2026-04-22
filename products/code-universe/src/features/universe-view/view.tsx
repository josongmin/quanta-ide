// Treemap (Universe) view descriptor — the default "base" view.
// --------------------------------------------------------------------
// Wraps the Pixi-powered CanvasViewport that renders the hierarchical
// LoC treemap. Unlike the other modes this one is the shell's base
// layer: the descriptor declares `overlay: "base"` so the shell mounts
// it directly into the viewport container without the translucent
// overlay wrapper that hosts every other view.

import { useMemo, type ReactElement } from "react";
import {
  buildHierarchicalLayout,
  type HierarchicalLayout,
} from "@quanta/canvas-engine";
import { CanvasViewport } from "./ui/CanvasViewport";
import { useTierSwitch } from "../tier-switch";
import { useLayoutWeight, makeWeightFn } from "../layout-weight";
import { loadViewport } from "../../shared/api/viewport-persistence";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { color, font } from "../../shared/ui/tokens";

function UniverseView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  const { tier } = useTierSwitch();
  const weightMode = useLayoutWeight(s => s.mode);

  const layout = useMemo<HierarchicalLayout | null>(
    () =>
      ctx.tree
        ? buildHierarchicalLayout(ctx.tree, {
            weight: makeWeightFn(ctx.tree, weightMode),
            // Sibling gutter / outer padding matched so a card's gap to
            // its neighbour reads the same as its gap to the parent's
            // edge — inner rows otherwise look cramped relative to the
            // rim. See CanvasShell's original comment for full context.
            gap: 32,
            padding: 32,
          })
        : null,
    [ctx.tree, weightMode],
  );

  if (!ctx.tree || !layout || !ctx.graph) {
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          color: color.text2,
          fontSize: font.size.md,
          fontStyle: "italic",
          letterSpacing: font.letter.wide,
        }}
      >
        <span style={{ opacity: 0.5 }}>·</span>
        <span>waiting for workspace graph</span>
        <span style={{ opacity: 0.5 }}>·</span>
      </div>
    );
  }

  const initialCamera = (() => {
    const saved = loadViewport(ctx.tabId);
    return saved ? { tx: saved.tx, ty: saved.ty, scale: saved.scale } : undefined;
  })();

  return (
    <CanvasViewport
      tree={ctx.tree}
      layout={layout}
      tier={tier}
      graph={ctx.graph}
      width={ctx.viewportSize.w}
      height={ctx.viewportSize.h}
      tabId={ctx.tabId}
      initialCamera={initialCamera}
    />
  );
}

export const universeViewDescriptor: ViewDescriptor = {
  id: "treemap",
  label: "Universe",
  glyph: "◎",
  hint: "계층 구조를 공간으로 표현",
  tech: "파일 계층 트리 + LoC",
  usecase:
    "코드베이스 온보딩 첫날 전체 구조 파악. 어떤 패키지가 가장 큰지(LoC 기준) 한눈에 확인. PR 리뷰 전 변경 파일이 어느 영역에 있는지 위치 확인.",
  category: "explore",
  contexts: ["repo", "folder", "file"],
  needs: { tree: true, graph: true },
  order: 20,
  overlay: "base",
  Component: UniverseView,
};
