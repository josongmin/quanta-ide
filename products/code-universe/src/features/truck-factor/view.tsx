// Truck Factor view descriptor — team-risk indicator.
// Reference: Avelino et al. "A Novel Approach for Estimating Truck Factors", FSE 2016.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { TruckFactorView } from "./ui/TruckFactorView";

function TruckFactorModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
  return <TruckFactorView ctx={ctx} />;
}

export const truckFactorViewDescriptor: ViewDescriptor = {
  id: "truck-factor",
  label: "Truck",
  glyph: "⚐",
  hint: "Truck Factor — 팀 리스크",
  tech: "파일별 유일 전문가 집계 (Avelino FSE 2016)",
  usecase: "N명 나가면 유지보수 못함. 팀 리스크 지표.",
  category: "team",
  contexts: ["repo", "folder"],
  needs: { tree: true },
  order: 590,
  Component: TruckFactorModeView,
};
