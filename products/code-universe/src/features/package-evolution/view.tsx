// PackageEvolution view descriptor — temporal multi-panel.
// --------------------------------------------------------------------
// References:
//   - Riva, "Software Cartography — A Visual Approach to Software
//     Architecture" (2004).
//   - Lungu, Lanza & Nierstrasz, "Evolutionary and Collaborative
//     Software Architecture Recovery", MSR 2007.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { PackageEvolutionView } from "./ui/PackageEvolutionView";

function PackageEvolutionModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
  const selectedId = ctx.selectedId;
  const entity = selectedId ? ctx.tree.byId.get(selectedId) : null;
  if (
    !entity ||
    (entity.kind !== "street" &&
      entity.kind !== "galaxy" &&
      entity.kind !== "universe")
  ) {
    return <PackageEvolutionView ctx={ctx} empty />;
  }
  return <PackageEvolutionView ctx={ctx} entity={entity} />;
}

export const packageEvolutionViewDescriptor: ViewDescriptor = {
  id: "package-evolution",
  label: "PkgEvo",
  glyph: "≈",
  hint: "패키지 진화 — LoC × churn × team",
  tech: "12개월 LoC 성장 × 주간 churn × 월간 저자수",
  usecase: "패키지가 언제 폭발 성장했나. 리팩터 타이밍 감지.",
  category: "history",
  contexts: ["folder"],
  needs: { tree: true, selection: true },
  order: 820,
  Component: PackageEvolutionModeView,
};
