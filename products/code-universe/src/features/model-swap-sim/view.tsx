// ModelSwap view descriptor — per-task model-swap impact simulator.
// --------------------------------------------------------------------
// Reference: Chen et al. "RouteLLM: Learning to Route LLMs with
// Preference Data" 2024; Ding et al. "FrugalGPT: How to Use Large
// Language Models While Reducing Cost and Improving Performance" 2023;
// plus the emerging 2025 concern around model-deprecation dependency
// risk — frontier APIs sunset, workflows must remain portable.

import type { ReactElement } from "react";
import type { Entity } from "@quanta/canvas-engine";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { ModelSwapSimView } from "./ui/ModelSwapSimView";

function ModelSwapSimModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
  const entity: Entity | null = ctx.selectedId ? ctx.tree.byId.get(ctx.selectedId) ?? null : null;
  if (!entity || (entity.kind !== "building" && entity.kind !== "floor")) {
    return <ModelSwapSimView ctx={ctx} empty />;
  }
  return <ModelSwapSimView ctx={ctx} entity={entity} />;
}

export const modelSwapSimViewDescriptor: ViewDescriptor = {
  id: "model-swap-sim",
  label: "ModelSwap",
  glyph: "⇌",
  hint: "모델 교체 시뮬레이션",
  tech: "태스크별 success × cost 교체 영향 분석",
  usecase:
    "frontier 모델 deprecated 되기 전 이식성 확인. 비용/정확도 trade-off.",
  category: "ai",
  contexts: ["file"],
  needs: { tree: true, selection: true },
  order: 1070,
  Component: ModelSwapSimModeView,
};
