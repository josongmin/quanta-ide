// Timelapse view descriptor — commit timelapse scrubber.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { TimelapseView } from "./ui/TimelapseView";

function TimelapseModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return <TimelapseView ctx={ctx} />;
}

export const timelapseViewDescriptor: ViewDescriptor = {
  id: "timelapse",
  label: "Timelapse",
  glyph: "⏴",
  hint: "커밋 타임랩스",
  tech: "git log × 파일 활성도",
  usecase: "한 분기 동안 repo가 어떻게 숨쉬었나 시각화. 신규 프로젝트/시즌 감지.",
  category: "history",
  contexts: ["repo", "folder"],
  needs: { tree: true },
  order: 650,
  Component: TimelapseModeView,
};
