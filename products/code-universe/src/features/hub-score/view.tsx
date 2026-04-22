// Hub view descriptor — fan-in × fan-out centrality scatter.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { HubScoreView } from "./ui/HubScoreView";

function HubScoreModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
  return <HubScoreView ctx={ctx} />;
}

export const hubScoreViewDescriptor: ViewDescriptor = {
  id: "hub-score",
  label: "Hub",
  glyph: "◉",
  hint: "연결 중심성 — 바꾸면 파급이 큰 파일",
  tech: "import/call 그래프의 fan-in × fan-out",
  usecase:
    "인터페이스 감사. '이거 바꾸면 터짐' 후보 파일 식별.",
  category: "metrics",
  contexts: ["repo", "folder"],
  needs: { tree: true },
  order: 230,
  Component: HubScoreModeView,
};
