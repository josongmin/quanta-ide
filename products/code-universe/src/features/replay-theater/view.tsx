// ReplayTheater view descriptor — agent session playback theater.
// --------------------------------------------------------------------
// Reference: Session-replay pattern popularized by LogRocket and
// FullStory for web apps, adapted here for AI agent runs; time-travel
// debugging literature (Microsoft Time Travel Debugging, rr 2017).

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { ReplayTheaterView } from "./ui/ReplayTheaterView";

function ReplayTheaterModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
  return <ReplayTheaterView ctx={ctx} />;
}

export const replayTheaterViewDescriptor: ViewDescriptor = {
  id: "replay-theater",
  label: "Replay",
  glyph: "▶",
  hint: "에이전트 세션 재생 극장",
  tech: "step timeline × scrubber × play controls",
  usecase:
    "에이전트 과거 실행 재현. 왜 실패했나 타임라인 재연.",
  category: "ai",
  contexts: ["repo"],
  needs: { tree: true },
  order: 895,
  Component: ReplayTheaterModeView,
};
