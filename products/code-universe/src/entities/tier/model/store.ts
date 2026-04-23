import { useRef, useSyncExternalStore } from "react";
import type { TierLadder, TierSpec } from "./types";
import {
  DEFAULT_TIER_LADDER,
  resolveTierByApparentSize,
  scaleForApparentPx,
} from "./types";
import { LEAF_WORLD_WIDTH } from "@quanta/canvas-engine";

// Tier store (apparent-size based)
// --------------------------------------------------------------------
// Owns the current zoom state for the canvas: ladder + camera scale +
// leaf-world-size + resolved tier. Hysteresis is baked in — a scale
// change only flips the active tier if the new scale crosses the
// OTHER side's apparent-px threshold. Direct threshold compare per
// frame would ping-pong at the band boundary.
//
// `leafWorldSize` is the reference constant used to convert camera
// scale into an apparent-pixel value for the leaf card. It defaults
// to `LEAF_WORLD_WIDTH` (exported by the engine) — the same constant
// the bottom-up layout uses to size leaves. Keeping one value lets
// the resolver stay scale-invariant across repo sizes.

export interface TierState {
  ladder: TierLadder;
  scale: number;
  leafWorldSize: number;
  activeTier: TierSpec;
}

function buildInitial(
  ladder: TierLadder = DEFAULT_TIER_LADDER,
  scale = 0.1,
  leafWorldSize = LEAF_WORLD_WIDTH,
): TierState {
  return {
    ladder,
    scale,
    leafWorldSize,
    activeTier: resolveTierByApparentSize(ladder, leafWorldSize, scale),
  };
}

let state: TierState = buildInitial();
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of [...listeners]) l();
}

function withinBand(spec: TierSpec, apparentPx: number): boolean {
  return apparentPx >= spec.minApparentPx && apparentPx < spec.maxApparentPx;
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
  /** Drive the scale from the viewport AND auto-flip the active tier
   *  when the camera crosses the current tier's apparent-px band edge.
   *  Hysteresis — re-resolve only when the scale drives the leaf card
   *  OUT of the current band — keeps the tier stable while the user
   *  zooms inside its range. */
  setScale(nextScale: number): void {
    if (nextScale === state.scale) return;
    const apparentPx = state.leafWorldSize * nextScale;
    const cur = state.activeTier;
    const nextTier = withinBand(cur, apparentPx)
      ? cur
      : resolveTierByApparentSize(state.ladder, state.leafWorldSize, nextScale);
    state = { ...state, scale: nextScale, activeTier: nextTier };
    emit();
  },
  /** Update the reference leaf world size. Normally a fresh layout
   *  keeps the same constant (`LEAF_WORLD_WIDTH`), but exposing the
   *  setter lets future work (e.g. per-language leaf sizing) drive it
   *  without a store rewrite. Re-resolves the active tier against the
   *  current scale so the HUD flips immediately if the leaf shrank. */
  setLeafWorldSize(next: number): void {
    if (!Number.isFinite(next) || next <= 0) return;
    if (next === state.leafWorldSize) return;
    state = {
      ...state,
      leafWorldSize: next,
      activeTier: resolveTierByApparentSize(state.ladder, next, state.scale),
    };
    emit();
  },
  /** Force-jump to a named tier (breadcrumb click, keyboard shortcut,
   *  Explorer selection, drill-in). Seeds `state.scale` with the
   *  camera scale that lands the leaf card in the MIDDLE of the
   *  target tier's apparent-px band — gives the tier some breathing
   *  room before the next user gesture flips it again. */
  jumpToTier(name: TierSpec["name"]): void {
    const spec = state.ladder.find(t => t.name === name);
    if (!spec) return;
    const midPx = Number.isFinite(spec.maxApparentPx)
      ? (spec.minApparentPx + spec.maxApparentPx) / 2
      : spec.minApparentPx * 1.5;
    const nextScale = scaleForApparentPx(state.leafWorldSize, midPx);
    state = { ...state, scale: nextScale, activeTier: spec };
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
