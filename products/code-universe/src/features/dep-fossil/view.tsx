// Fossil — descriptor for the deprecated-API timeline view.
// --------------------------------------------------------------------
// Horizontal axis = "first introduced" (oldest → newest). Each row =
// a deprecated / legacy API still alive in the codebase. Dots along
// the timeline = individual file uses. Row tint intensity ∝ total uses.
// Top rows = worst offenders so the user's eye falls straight on them.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { FossilView } from "./ui/FossilView";

function FossilModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  return <FossilView ctx={ctx} />;
}

export const depFossilViewDescriptor: ViewDescriptor = {
  id: "dep-fossil",
  label: "Fossil",
  glyph: "☍",
  hint: "화석 — 살아남은 deprecated API",
  tech: "import 스캔 × deprecated 목록",
  usecase: "청소 우선순위. 오래되고 지금도 쓰이는 legacy 식별.",
  category: "security",
  contexts: ["repo"],
  needs: { tree: true },
  order: 560,
  Component: FossilModeView,
};
