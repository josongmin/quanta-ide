// FileHistory view descriptor — git log on one file.
// --------------------------------------------------------------------
// References:
//   - Voinea & Telea, "Visual Analysis of Software Repositories" (VISSOFT
//     2006) — commit time-axis with author coloring.
//   - Lanza & Ducasse, CodeMap — LoC-over-time growth line.
// Applied to a single file: LoC growth line on top, commit dots in
// the middle (author hue, size ∝ lines changed), author blame rainbow
// strip on the bottom (line-by-line author tint).

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { FileHistoryView } from "./ui/FileHistoryView";

function FileHistoryModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  const selectedId = ctx.selectedId;
  const entity = selectedId ? ctx.tree.byId.get(selectedId) : null;
  if (!entity || (entity.kind !== "building" && entity.kind !== "floor" && entity.kind !== "room")) {
    return <FileHistoryView ctx={ctx} empty />;
  }
  return <FileHistoryView ctx={ctx} entity={entity} />;
}

export const fileHistoryViewDescriptor: ViewDescriptor = {
  id: "file-history",
  label: "FileLog",
  glyph: "◔",
  hint: "파일 한 화면 git log",
  tech: "git log × blame × LoC growth",
  usecase: "이 파일이 언제 어떻게 진화했나. 최근 바쁜 구간 스캔.",
  category: "history",
  contexts: ["file"],
  needs: { tree: true, selection: true },
  order: 810,
  Component: FileHistoryModeView,
};
