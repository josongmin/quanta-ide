import { useEffect } from "react";
import { LodManager, LOD_TIERS } from "@quanta/canvas-engine";
import { useViewportStore } from "../store/viewport-store";
import { useSettingsStore } from "../store/settings-store";
import { interactionStore } from "../store/interaction-store";

// The manager internally reads thresholds from `LOD_TIERS` (imported here
// purely to make the config dependency explicit — changing any tier's
// up/downThreshold in lod-config.ts immediately affects this hook via the
// LodManager instance below).
void LOD_TIERS;

// Kept as a module singleton (not a React ref) because non-hook consumers
// may read it. Swap-safety is handled via the graphKey-keyed reset below.
const manager = new LodManager();

export function useLodSync(graphKey: string = "default") {
  // Subscribe directly to the owning sub-stores so a settings change
  // (e.g. `showEdges` toggle) doesn't trigger this effect, and vice
  // versa — only scale and forceLod matter here.
  const scale    = useViewportStore(s => s.viewport.scale);
  const forceLod = useSettingsStore(s => s.forceLod);

  useEffect(() => {
    manager.reset();
  }, [graphKey]);

  useEffect(() => {
    const next = forceLod === "auto" ? manager.update(scale) : forceLod;
    const current = interactionStore.getState().lod;
    if (next !== current) interactionStore.setLod(next);
  }, [scale, forceLod]);
}
