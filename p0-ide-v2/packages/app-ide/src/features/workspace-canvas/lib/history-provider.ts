// history-provider — single DI seam that decides which `HistorySource`
// the time-travel UI binds to. Kept deliberately small: no container,
// no registry, just a function the store can call.
//
// WHY: the concrete `MockHistorySource` / `GitHistorySource` classes are
// sealed behind factories in `@quanta/canvas-engine`. Consumers ask for a
// `HistorySource` here and get whichever implementation fits the build.
// The provider owns the mock/git selection policy; the store owns the
// lifecycle (load, current sha, subscribers).

import {
  createGitHistorySource,
  createMockHistorySource,
  type HistorySource,
} from "@quanta/canvas-engine";
import { SAMPLE_GRAPH } from "../data/sample-graph";

export type HistorySourceKind = "mock" | "git";

// Build-time flag. Read via `import.meta.env` so Vite inlines it; if the
// key is absent (e.g. vitest) we default to `false` and stay on mock.
// WHY: Git provider is experimental, mock is the default until an ADR
// for dev-server-backed history lands.
interface ImportMetaEnvQuanta {
  env?: Record<string, string | undefined>;
}

function isGitSourceEnabled(): boolean {
  const env = (import.meta as ImportMetaEnvQuanta).env;
  return env?.VITE_GIT_HISTORY === "1" || env?.VITE_GIT_HISTORY === "true";
}

/**
 * Return the currently-preferred HistorySource kind. Pure function —
 * UI code reads this when it needs to label which source is active
 * before the store has loaded anything.
 */
export function getPreferredHistoryKind(): HistorySourceKind {
  return isGitSourceEnabled() ? "git" : "mock";
}

/**
 * Construct a fresh HistorySource appropriate for this build. Callers
 * (typically the history store) invoke this once per kind swap; the
 * returned source owns its own caching, so repeated calls are cheap.
 */
export function getHistorySource(kind: HistorySourceKind = getPreferredHistoryKind()): HistorySource {
  if (kind === "git") {
    return createGitHistorySource();
  }
  const history = SAMPLE_GRAPH.history;
  if (!history) {
    // WHY: if sample graph ships without a synthesized history, hand
    // the factory an empty shell so the UI can render "no commits"
    // instead of crashing on a null source.
    return createMockHistorySource({ snapshots: [], baseIndex: 0 }, SAMPLE_GRAPH.fileEdges);
  }
  return createMockHistorySource(history, SAMPLE_GRAPH.fileEdges);
}
