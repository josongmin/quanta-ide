// DeterminismDrift view descriptor — same-prompt output variance over time.
// --------------------------------------------------------------------
// Reference: Holtzman et al. "The Curious Case of Neural Text Degeneration
// (Nucleus Sampling)" ICLR 2020; Achiam et al. "Determinism in LLMs"
// (practitioner write-ups); Anthropic model release notes and their
// observed downstream workflow impact (2025).

import type { ReactElement } from "react";
import type { Entity } from "@quanta/canvas-engine";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { DeterminismDriftView } from "./ui/DeterminismDriftView";

function DeterminismDriftModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
  const entity: Entity | null = ctx.selectedId ? ctx.tree.byId.get(ctx.selectedId) ?? null : null;
  if (!entity || (entity.kind !== "building" && entity.kind !== "floor")) {
    return <DeterminismDriftView ctx={ctx} empty />;
  }
  return <DeterminismDriftView ctx={ctx} entity={entity} />;
}

export const determinismDriftViewDescriptor: ViewDescriptor = {
  id: "determinism-drift",
  label: "Drift",
  glyph: "∿",
  hint: "동일 프롬프트 출력 표류 — 주간",
  tech: "12주 output hash bucket × drift 이벤트 감지",
  usecase: "모델 업데이트가 내 워크플로우 망가뜨리는 순간 포착.",
  category: "ai",
  contexts: ["file"],
  needs: { tree: true, selection: true },
  order: 1080,
  Component: DeterminismDriftModeView,
};
