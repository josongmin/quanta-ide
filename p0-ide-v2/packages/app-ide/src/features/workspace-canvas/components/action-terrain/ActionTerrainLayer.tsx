import { useEffect } from "react";
import { useFeature } from "../../store/feature-flags-store";
import { useActionTerrain } from "../../hooks/use-action-terrain";
import { actionTerrainRenderStore } from "../../store/action-terrain-store";

// Single caller of `useActionTerrain`. Other consumers read derived data
// from `actionTerrainRenderStore` so ROI compute runs exactly once per
// dependency change — not once per component that needs it.
// Returns null; the render store is the output.

export function ActionTerrainLayer(): null {
  const on = useFeature("action-terrain.mode");
  const derived = useActionTerrain();

  useEffect(() => {
    if (!on || !derived.enabled) {
      actionTerrainRenderStore.reset();
      return;
    }
    actionTerrainRenderStore.set({
      enabled: true,
      roi: derived.roi,
      suggestions: derived.suggestions,
      simulation: derived.simulation,
      cone: derived.cone,
      bars: derived.bars,
      coneForRenderer: derived.coneForRenderer,
      isoConfig: derived.isoConfig,
    });
    return () => {
      // Reset on unmount so a remount of the canvas gets a clean slate.
      actionTerrainRenderStore.reset();
    };
  }, [on, derived]);

  return null;
}
