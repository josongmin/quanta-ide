// FileGauge view descriptor — single-file quality dashboard.
// --------------------------------------------------------------------
// Reference: SonarSource file-detail page pattern (metric tiles with
// threshold markers and hero numbers). Applied per-file so code
// reviewers get a one-glance readout of the file under review.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { FileGaugeView } from "./ui/FileGaugeView";

function FileGaugeModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  const selectedId = ctx.selectedId;
  const entity = selectedId ? ctx.tree.byId.get(selectedId) : null;
  if (!entity || (entity.kind !== "building" && entity.kind !== "floor" && entity.kind !== "room")) {
    return <FileGaugeView ctx={ctx} empty />;
  }
  return <FileGaugeView ctx={ctx} entity={entity} />;
}

export const fileGaugeViewDescriptor: ViewDescriptor = {
  id: "file-gauge",
  label: "FileGauge",
  glyph: "◎",
  hint: "단일 파일 헬스 대시보드",
  tech: "Sonar file-detail × per-file synth metrics",
  usecase: "이 파일 얼마나 건강한가 한 눈에. 코드리뷰 컨텍스트 브리프.",
  category: "metrics",
  contexts: ["file"],
  needs: { tree: true, selection: true },
  order: 342,
  Component: FileGaugeModeView,
};
