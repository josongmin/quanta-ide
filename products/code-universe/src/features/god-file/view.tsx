// God-file view descriptor — ranked list of oversized / multi-responsibility files.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { GodFileView } from "./ui/GodFileView";

function GodFileModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return (
    <GodFileView
      tree={ctx.tree}
      onFocusEntity={id => ctx.dispatch.selectEntity(id)}
      onDismiss={() => ctx.dispatch.selectEntity(null)}
    />
  );
}

export const godFileViewDescriptor: ViewDescriptor = {
  id: "god-file",
  label: "God",
  glyph: "◉",
  hint: "신(神)급 파일 — 너무 많은 책임",
  tech: "LoC + 응집도 클러스터링",
  usecase: "분리 리팩터링 후보. 한 파일에 도메인 2~3개.",
  category: "refactor",
  contexts: ["repo", "folder"],
  needs: { tree: true },
  order: 430,
  Component: GodFileModeView,
};
