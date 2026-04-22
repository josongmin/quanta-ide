// FileTwins view descriptor — "5-8 files that look like this one".
// --------------------------------------------------------------------
// Reference: Zhou & Wong, "Supporting software maintenance through
// structural clustering" (ISSRE 2008) — nearest-neighbour file
// clustering over structural fingerprint. Synthesised composite
// similarity: name Jaccard + seeded structural + seeded co-change.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { FileTwinsView } from "./ui/FileTwinsView";

function FileTwinsModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  const selectedId = ctx.selectedId;
  const entity = selectedId ? ctx.tree.byId.get(selectedId) : null;
  if (!entity || (entity.kind !== "building" && entity.kind !== "floor" && entity.kind !== "room")) {
    return <FileTwinsView ctx={ctx} empty />;
  }
  return <FileTwinsView ctx={ctx} entity={entity} />;
}

export const fileTwinsViewDescriptor: ViewDescriptor = {
  id: "file-twins",
  label: "Twins",
  glyph: "⏣",
  hint: "이 파일과 비슷한 5개",
  tech: "임베딩 × co-change × 구조 합성 유사도",
  usecase: "비슷한 파일에서 이미 해결된 패턴 찾기. '얘랑 똑같이 처리해'",
  category: "explore",
  contexts: ["file"],
  needs: { tree: true, selection: true },
  order: 85,
  Component: FileTwinsModeView,
};
