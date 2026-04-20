import { useRef, useSyncExternalStore } from "react";
import type { TierLadder, TierSpec } from "./types";
import { DEFAULT_TIER_LADDER, resolveTierByScale } from "./types";

// Tier store
// --------------------------------------------------------------------
// Owns the current zoom state for the canvas (scale + resolved tier)
// and exposes the ladder the product uses. Hysteresis handled here:
// a scale change only flips the active tier if the new scale crosses
// the OTHER side's threshold — direct threshold compare per frame
// would ping-pong at the band boundary.

export interface TierState {
  ladder: TierLadder;
  scale: number;
  activeTier: TierSpec;
}

function buildInitial(ladder: TierLadder = DEFAULT_TIER_LADDER, scale = 0.1): TierState {
  return { ladder, scale, activeTier: resolveTierByScale(ladder, scale) };
}

let state: TierState = buildInitial();
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of [...listeners]) l();
}

export const tierStore = {
  getState(): TierState {
    return state;
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  /** Drive the scale from the viewport. Re-resolves the tier with
   *  hysteresis: only flip when the new scale has crossed the
   *  current tier's BOUNDING threshold, not just any threshold. */
  setScale(nextScale: number): void {
    if (nextScale === state.scale) return;
    const cur = state.activeTier;
    const within = nextScale >= cur.downThreshold && nextScale < cur.upThreshold;
    const nextTier = within ? cur : resolveTierByScale(state.ladder, nextScale);
    if (nextTier === cur && nextScale === state.scale) return;
    state = { ...state, scale: nextScale, activeTier: nextTier };
    emit();
  },
  /** Force-jump to a named tier (breadcrumb click, keyboard shortcut).
   *  Uses the tier's midpoint scale so hysteresis doesn't snap back. */
  jumpToTier(name: TierSpec["name"]): void {
    const spec = state.ladder.find(t => t.name === name);
    if (!spec) return;
    const mid = Number.isFinite(spec.upThreshold)
      ? (spec.downThreshold + spec.upThreshold) / 2
      : spec.downThreshold * 1.5;
    state = { ...state, scale: mid, activeTier: spec };
    emit();
  },
  reset(): void {
    state = buildInitial();
    emit();
  },
};

export function useTierState<T>(selector: (s: TierState) => T): T {
  // Cache the selector output keyed on state identity. Without this a
  // selector that allocates (e.g. `s => ({ a: s.a, b: s.b })`) returns
  // a fresh reference every call; React's useSyncExternalStore compares
  // snapshots with Object.is, sees "changed" each render, and schedules
  // another render → infinite loop + "getSnapshot should be cached".
  // Caching by state identity keeps the snapshot reference stable
  // between real store emissions no matter what shape the selector
  // returns, so every consumer site is safe by construction.
  const cache = useRef<{ state: TierState; value: T } | null>(null);
  return useSyncExternalStore(tierStore.subscribe, () => {
    const s = tierStore.getState();
    const c = cache.current;
    if (c && c.state === s) return c.value;
    const value = selector(s);
    cache.current = { state: s, value };
    return value;
  });
}
