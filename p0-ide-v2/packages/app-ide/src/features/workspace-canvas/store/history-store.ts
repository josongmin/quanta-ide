import { useSyncExternalStore } from "react";
import type {
  CommitMeta,
  HistorySource,
} from "@quanta/canvas-engine";
import { featureFlagsStore } from "./feature-flags-store";
import {
  getHistorySource,
  getPreferredHistoryKind,
  type HistorySourceKind,
} from "../lib/history-provider";
export type { HistorySourceKind };

// History store (T1 — time-travel data foundation)
// -------------------------------------------------------------------
// Thin wrapper over a `HistorySource`. The source itself (mock vs real
// git) is owned by the app bootstrap; this store caches its output so
// the film-strip / dual-split / blame-time-travel UIs can subscribe
// synchronously.
//
// Responsibilities:
//   * Hold the currently-selected source (mock by default).
//   * Hold the commit list (newest-first) after `loadCommits`.
//   * Track `currentSha` — the commit the canvas is "time-travelled" to.
//   * React to the `temporal.gitSource` feature flag by swapping the
//     source when the user toggles it in the HUD.
//
// The store does NOT materialize edge sets itself — callers that need
// the absolute set at a sha should call `source.edgeSetAt(sha)` which
// is already memoized inside the source. Keeping that out of the store
// avoids accidental sync→async mismatches in the UI.

export interface HistoryState {
  /** Active source. Undefined before the app wires one in. */
  source: HistorySource | null;
  /** Which kind is currently active — used by the HUD to show the source name. */
  kind: HistorySourceKind;
  /** Commits returned by the last `loadCommits` call. */
  commits: readonly CommitMeta[];
  /** Sha the canvas is scrubbed to; null ⇒ live (most recent). */
  currentSha: string | null;
  /** Monotonic counter — bumps on every successful load, for memo deps. */
  loadEpoch: number;
  /** True while an async load is pending. */
  loading: boolean;
  /** Last non-fatal load error, if any. */
  error: string | null;
}

type Factories = Partial<Record<HistorySourceKind, () => HistorySource>>;
// Mutable, module-scoped factory registry. Tests call
// `registerSourceFactory("mock", () => fakeSource)` to inject a fake.
// In production no factory is registered: `buildSource` falls back to
// `getHistorySource()` from `../lib/history-provider`, which picks the
// mock or git implementation based on the build-time flag.
const factories: Factories = {};

function initialState(): HistoryState {
  // Seed `source` via the provider so the time-travel UI works out of the
  // box in production. Tests that want to override the source still call
  // `registerSourceFactory(...)` which rebuilds `state.source`.
  const kind = getPreferredHistoryKind();
  let source: HistorySource | null;
  try {
    source = getHistorySource(kind);
  } catch {
    source = null;
  }
  return {
    source,
    kind,
    commits: [],
    currentSha: null,
    loadEpoch: 0,
    loading: false,
    error: null,
  };
}

let state: HistoryState = initialState();
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of [...listeners]) l();
}

function getState(): HistoryState { return state; }

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function kindFromFlag(): HistorySourceKind {
  return featureFlagsStore.isEnabled("temporal.gitSource") ? "git" : "mock";
}

function buildSource(kind: HistorySourceKind): HistorySource | null {
  const f = factories[kind];
  try {
    // Prefer a test-registered factory; otherwise fall back to the
    // production provider. The provider is the single place that knows
    // how to construct Mock vs Git sources; the store stays oblivious.
    return f ? f() : getHistorySource(kind);
  } catch {
    return null;
  }
}

/**
 * Register a factory for a particular source kind. Safe to call
 * repeatedly — the latest registration wins (useful for HMR). When
 * the currently-active kind's factory is updated, the active source
 * is rebuilt eagerly and subscribers are notified.
 */
function registerSourceFactory(
  kind: HistorySourceKind,
  factory: () => HistorySource,
): void {
  factories[kind] = factory;
  if (state.kind === kind) {
    const source = buildSource(kind);
    state = { ...state, source };
    emit();
  } else if (!state.source) {
    // First-ever registration of any kind — adopt it if it matches the
    // flag, otherwise keep waiting for the preferred kind.
    const preferred = kindFromFlag();
    if (preferred === kind) {
      state = { ...state, kind, source: buildSource(kind) };
      emit();
    }
  }
}

/**
 * Force-set the active kind. Normally callers don't need this: the
 * store follows the `temporal.gitSource` feature flag automatically.
 * Exposed for scenario tests.
 */
function setKind(kind: HistorySourceKind): void {
  if (state.kind === kind) return;
  state = {
    ...state,
    kind,
    source: buildSource(kind),
    // Invalidate caches — commit list differs per source.
    commits: [],
    currentSha: null,
  };
  emit();
}

async function loadCommits(limit = 200): Promise<void> {
  const source = state.source;
  if (!source) {
    state = { ...state, commits: [], loading: false, error: "no history source" };
    emit();
    return;
  }
  const originEpoch = state.loadEpoch;
  state = { ...state, loading: true, error: null };
  emit();
  try {
    const commits = await source.listCommits({ limit });
    // Drop stale responses — a later load may have superseded us.
    if (state.loadEpoch !== originEpoch) return;
    state = {
      ...state,
      commits,
      loading: false,
      error: null,
      loadEpoch: originEpoch + 1,
    };
    emit();
  } catch (err) {
    if (state.loadEpoch !== originEpoch) return;
    state = {
      ...state,
      loading: false,
      error: String(err),
      commits: [],
    };
    emit();
  }
}

function setCurrentSha(sha: string | null): void {
  if (state.currentSha === sha) return;
  state = { ...state, currentSha: sha };
  emit();
}

function reset(): void {
  state = initialState();
  emit();
}

// Track the feature-flags store so the source swaps live when the
// user toggles `temporal.gitSource` in the HUD. We attach exactly once
// at module load so callers don't need to opt-in.
featureFlagsStore.subscribe(() => {
  const nextKind = kindFromFlag();
  if (nextKind === state.kind) return;
  setKind(nextKind);
});

export const historyStore = {
  getState,
  subscribe,
  registerSourceFactory,
  setKind,
  loadCommits,
  setCurrentSha,
  reset,
};

export function useHistoryStore<T>(selector: (s: HistoryState) => T): T {
  return useSyncExternalStore(
    historyStore.subscribe,
    () => selector(historyStore.getState()),
    () => selector(historyStore.getState()),
  );
}

/** Convenience — the currently-selected commit meta, if any. */
export function useCurrentCommit(): CommitMeta | null {
  return useHistoryStore(s => {
    if (!s.currentSha) return null;
    return s.commits.find(c => c.sha === s.currentSha) ?? null;
  });
}
