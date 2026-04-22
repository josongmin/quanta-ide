// ShotgunSurgery view descriptor — one-change-many-files smell.
// --------------------------------------------------------------------
// Grid of "blast patterns": central file surrounded by 5-15 files it
// typically co-changes with, each drawn as a tapered bezier radiating
// outward. Cards are ranked by total spread.
//
// Reference: Fowler *Refactoring* (1999). Co-change based detection.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { ShotgunSurgeryView } from "./ui/ShotgunSurgeryView";

function ShotgunSurgeryModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
  return <ShotgunSurgeryView ctx={ctx} />;
}

export const shotgunSurgeryViewDescriptor: ViewDescriptor = {
  id: "shotgun-surgery",
  label: "Shotgun",
  glyph: "⁂",
  hint: "Shotgun Surgery — 한 변경이 여러 파일에 흩뿌려짐",
  tech: "co-change 빈도 × 변경당 영향 파일 수",
  usecase: "강한 결합 탐지. Extract Class / Move Feature 후보.",
  category: "refactor",
  contexts: ["repo", "folder"],
  needs: { tree: true },
  order: 450,
  Component: ShotgunSurgeryModeView,
};
