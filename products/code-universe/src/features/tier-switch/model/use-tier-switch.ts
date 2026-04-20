import { useCallback } from "react";
import { tierStore, useTierState, type TierSpec } from "../../../entities/tier";

// Feature — tier switching
// --------------------------------------------------------------------
// Thin imperative wrapper over `tierStore` that gives widgets a
// React-friendly tuple: current tier, scale, and two action
// callbacks (zoom by delta, jump to named tier). The store itself is
// framework-free; this hook is the binding for the product's widgets.
//
// Zoom deltas multiply rather than add: human-perceived zoom is
// logarithmic, so `setScale(scale * factor)` matches the way a wheel
// or pinch gesture feels. The raw `setScale` stays available for
// external camera drivers (e.g. smooth-camera tweens).

export interface TierSwitchApi {
  tier: TierSpec;
  scale: number;
  zoomBy(factor: number): void;
  setScale(scale: number): void;
  jumpTo(name: TierSpec["name"]): void;
}

export function useTierSwitch(): TierSwitchApi {
  // Two primitive subscriptions, not one object selector. An object
  // selector `s => ({ activeTier, scale })` returns a fresh reference
  // on every call; `useSyncExternalStore` compares snapshots with
  // Object.is, so each render looks like a state change and schedules
  // another render → infinite loop + "getSnapshot should be cached".
  // Primitive selectors return the same reference between real store
  // updates, so the equality check terminates the update cycle.
  const activeTier = useTierState(s => s.activeTier);
  const scale = useTierState(s => s.scale);

  const zoomBy = useCallback((factor: number) => {
    if (factor <= 0 || !Number.isFinite(factor)) return;
    const cur = tierStore.getState().scale;
    tierStore.setScale(cur * factor);
  }, []);

  const setScale = useCallback((next: number) => {
    if (!Number.isFinite(next) || next <= 0) return;
    tierStore.setScale(next);
  }, []);

  const jumpTo = useCallback((name: TierSpec["name"]) => {
    tierStore.jumpToTier(name);
  }, []);

  return { tier: activeTier, scale, zoomBy, setScale, jumpTo };
}
