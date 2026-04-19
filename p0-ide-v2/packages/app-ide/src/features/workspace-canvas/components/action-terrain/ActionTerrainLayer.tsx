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

  // WHY: the pump effect must NOT return a cleanup — React calls cleanup
  // on every dep change, which would emit reset→set on every ROI tick and
  // unmount/remount `RefactorBacklogPanel` (wiping its local `expandedFileIds`
  // state). Unmount-time reset lives in the separate effect below with []
  // deps so it only fires on true unmount.
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
      bars: derived.bars,
      coneForRenderer: derived.coneForRenderer,
      isoConfig: derived.isoConfig,
    });
  }, [on, derived]);

  useEffect(() => () => { actionTerrainRenderStore.reset(); }, []);

  return null;
}
