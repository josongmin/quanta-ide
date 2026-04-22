// Dupe-clusters view descriptor — groups of near-duplicate files.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { DupeClustersView } from "./ui/DupeClustersView";

function DupeClustersModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return (
    <DupeClustersView
      tree={ctx.tree}
      onFocusEntity={id => ctx.dispatch.selectEntity(id)}
      onDismiss={() => ctx.dispatch.selectEntity(null)}
    />
  );
}

export const dupeClustersViewDescriptor: ViewDescriptor = {
  id: "dupe-clusters",
  label: "Dupes",
  glyph: "≡",
  hint: "중복 코드 클러스터",
  tech: "AST 지문 기반 유사도",
  usecase: "리팩터링 후보. 공통 추출.",
  category: "refactor",
  contexts: ["repo", "folder"],
  needs: { tree: true },
  order: 420,
  Component: DupeClustersModeView,
};
