// PackageInstability view descriptor — Martin I/A plot.
// --------------------------------------------------------------------
// References:
//   - Robert C. Martin, "Design Principles and Design Patterns" (2000).
//   - Robert C. Martin, "Clean Architecture" (2017), stability metrics ch.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { PackageInstabilityView } from "./ui/PackageInstabilityView";

function PackageInstabilityModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
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
    return <PackageInstabilityView ctx={ctx} empty />;
  }
  return <PackageInstabilityView ctx={ctx} entity={entity} />;
}

export const packageInstabilityViewDescriptor: ViewDescriptor = {
  id: "package-instability",
  label: "I/A",
  glyph: "⧨",
  hint: "Martin I/A — 불안정성 × 추상성",
  tech: "Ca/Ce fan-in/fan-out × main-sequence distance",
  usecase: "아키 건강도. Zone of Pain / Uselessness 식별.",
  category: "arch",
  contexts: ["folder"],
  needs: { tree: true, selection: true },
  order: 540,
  Component: PackageInstabilityModeView,
};
