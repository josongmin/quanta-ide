// Bus Factor view descriptor — sole-ownership risk ranking.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { BusFactorView } from "./ui/BusFactorView";

function BusFactorModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
  return <BusFactorView ctx={ctx} />;
}

export const busFactorViewDescriptor: ViewDescriptor = {
  id: "bus-factor",
  label: "Bus",
  glyph: "◍",
  hint: "버스 팩터 — 한 사람 의존 파일",
  tech: "git blame author 분포 집계",
  usecase:
    "팀 리스크 감지. '이 사람 나가면 아무도 못 만짐' 찾기.",
  category: "team",
  contexts: ["repo", "folder"],
  needs: { tree: true },
  order: 580,
  Component: BusFactorModeView,
};
