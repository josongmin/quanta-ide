import { useEffect } from "react";
import { useFeature } from "../../store/feature-flags-store";
import { useActionTerrain } from "../../hooks/use-action-terrain";
import { actionTerrainRenderStore } from "../../store/action-terrain-store";

// Data-pump for the Action Terrain overlay.
// -------------------------------------------------------------------
// Runs the `useActionTerrain` hook (the expensive ROI/suggestion/cone
// compute) and pushes the render-ready payload into
// `actionTerrainRenderStore`. MultiFileCanvas reads that store when it
// composes the Pixi overlay ctx, which keeps the canvas DOM tree clean
// of ROI math and also lets the RefactorBacklogPanel consume the same
// derived ROI/suggestions without double-computing.
//
// Returns `null` — this component emits data, not DOM.

export function ActionTerrainLayer(): null {
  const on = useFeature("action-terrain.mode");
  const result = useActionTerrain();

  useEffect(() => {
    if (!on || !result.enabled) {
      actionTerrainRenderStore.reset();
      return;
    }
    actionTerrainRenderStore.set({
      enabled: true,
      bars: result.bars,
      cone: result.coneForRenderer,
      isoConfig: result.isoConfig,
    });
  }, [on, result]);

  // On unmount, flush the render slice so a stale iso overlay doesn't linger.
  useEffect(() => () => actionTerrainRenderStore.reset(), []);

  return null;
}
