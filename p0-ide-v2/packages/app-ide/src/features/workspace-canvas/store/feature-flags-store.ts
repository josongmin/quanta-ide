import { useSyncExternalStore } from "react";
import {
  FEATURE_REGISTRY,
  FEATURE_BY_ID,
  type FeatureDescriptor,
} from "../lib/feature-registry";

// Feature-flags store — one boolean per registered feature. Seeded from
// `FEATURE_REGISTRY.defaultEnabled`. User toggles in the HUD persist to
// `localStorage` so a refresh keeps the chosen loadout. A feature can be
// force-disabled remotely by calling `setFlag(id, false)` from a kill-switch
// (e.g., analyzer reports the feature broke in a particular repo).

// Bumped v1 → v2 when the default loadout changed (most Batch 1–7 features
// flipped OFF by default). Old persisted flags would otherwise shadow the new
// minimal defaults for returning users. The legacy key is cleared on read.
const STORAGE_KEY = "quanta.canvas.featureFlags.v2";
const LEGACY_STORAGE_KEYS = ["quanta.canvas.featureFlags.v1"] as const;

type FlagsShape = Record<string, boolean>;

function seedFlags(): FlagsShape {
  const out: FlagsShape = {};
  for (const f of FEATURE_REGISTRY) out[f.id] = f.defaultEnabled;
  return out;
}

function readPersisted(): FlagsShape | null {
  try {
    if (typeof localStorage === "undefined") return null;
    // Drop any legacy keys so they never come back. This lets a schema bump
    // cleanly invalidate stale user overrides without needing a migration.
    for (const k of LEGACY_STORAGE_KEYS) localStorage.removeItem(k);
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const out: FlagsShape = {};
    for (const f of FEATURE_REGISTRY) {
      out[f.id] = typeof parsed[f.id] === "boolean" ? parsed[f.id] : f.defaultEnabled;
    }
    return out;
  } catch {
    return null;
  }
}

function writePersisted(flags: FlagsShape): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(flags));
  } catch {
    // Swallow — persistence is best-effort.
  }
}

interface FeatureFlagsState {
  flags: FlagsShape;
}

let state: FeatureFlagsState = {
  flags: readPersisted() ?? seedFlags(),
};
const listeners = new Set<() => void>();

function emit() {
  for (const l of [...listeners]) l();
}

function getState(): FeatureFlagsState {
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/**
 * Returns true iff the feature is flag-enabled AND every hard dependency
 * is also enabled. Callers should use this as the single gate.
 */
function isEnabled(id: string): boolean {
  const desc = FEATURE_BY_ID.get(id);
  if (!desc) return false;
  if (state.flags[id] === false) return false;
  if (desc.dependsOn) {
    for (const dep of desc.dependsOn) {
      if (!isEnabled(dep)) return false;
    }
  }
  return true;
}

const actions = {
  setFlag(id: string, enabled: boolean): void {
    if (!FEATURE_BY_ID.has(id)) return;
    if (state.flags[id] === enabled) return;
    const next = { ...state.flags, [id]: enabled };
    state = { flags: next };
    writePersisted(next);
    emit();
  },

  resetToDefaults(): void {
    const next = seedFlags();
    state = { flags: next };
    writePersisted(next);
    emit();
  },

  enableCategory(category: FeatureDescriptor["category"], enabled: boolean): void {
    const next = { ...state.flags };
    let changed = false;
    for (const f of FEATURE_REGISTRY) {
      if (f.category === category && next[f.id] !== enabled) {
        next[f.id] = enabled;
        changed = true;
      }
    }
    if (!changed) return;
    state = { flags: next };
    writePersisted(next);
    emit();
  },
};

export const featureFlagsStore = {
  getState,
  subscribe,
  isEnabled,
  ...actions,
};

export function useFeatureFlags<T>(selector: (s: FeatureFlagsState) => T): T {
  return useSyncExternalStore(
    featureFlagsStore.subscribe,
    () => selector(featureFlagsStore.getState()),
    () => selector(featureFlagsStore.getState()),
  );
}

/** React hook that returns the resolved enabled-state for a feature id. */
export function useFeature(id: string): boolean {
  return useFeatureFlags(() => featureFlagsStore.isEnabled(id));
}
