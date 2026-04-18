import { SAMPLE_SOURCES } from "./sample-graph";
import { loadFileSource, loadFileSourceBatch } from "./repo-loader";
import { sceneStore } from "../store/scene-store";
import type { GroundFileData } from "../store/scene-store";
import type { GraphSource } from "./graph-source";

// Optional active GraphSource. When set (typically by WorkspaceApp after
// constructing a MockGraphSource / future engine source), loaders prefer
// its `loadFileSource` over the raw dev-server endpoint. When unset, the
// existing repo-loader path is used so nothing breaks for legacy callers.
let activeGraphSource: GraphSource | null = null;

export function setActiveGraphSource(source: GraphSource | null): void {
  activeGraphSource = source;
}

export function getActiveGraphSource(): GraphSource | null {
  return activeGraphSource;
}

// Resolves ground-level source for a single file.
// - If a real repo is loaded (store.repoRoot set), fetches the file over
//   the dev-server's /__repo/file endpoint.
// - Otherwise (sample graph), falls back to the built-in SAMPLE_SOURCES.
// - If both fail, returns an empty string so the caller can render a
//   placeholder rather than a spinner forever.
export async function loadGroundData(fileId: string): Promise<GroundFileData> {
  // Prefer the active GraphSource if it exposes a file-source fetcher.
  // This is the forward path for engine-backed sources that carry their
  // own transport and don't need a separate `repoRoot`.
  if (activeGraphSource?.loadFileSource) {
    try {
      const source = await activeGraphSource.loadFileSource(fileId);
      return { source };
    } catch {
      const fallback = SAMPLE_SOURCES[fileId] ?? "";
      return { source: fallback };
    }
  }
  const repoRoot = sceneStore.getState().repoRoot;
  if (repoRoot) {
    try {
      const source = await loadFileSource({ repoRoot, fileId });
      return { source };
    } catch {
      // Network/server error — fall through to sample-source lookup, which
      // will almost certainly also miss for a real-repo file id. Returning
      // an empty source lets the GroundCard show the "—" placeholder.
      const fallback = SAMPLE_SOURCES[fileId] ?? "";
      return { source: fallback };
    }
  }
  const source = SAMPLE_SOURCES[fileId] ?? "";
  return { source };
}

// Batch-aware variant used by the ground-data batch coordinator.
// Returns a `fileId → GroundFileData` map with entries for every
// requested id (missing files fall back to empty source).
//
// Hits `/__repo/file/batch` (one HTTP round-trip for N files) when a
// real repo is loaded; falls back to SAMPLE_SOURCES for the sample
// graph. A single network failure does not poison the whole batch —
// we fall back per-id.
export async function loadGroundDataBatch(
  fileIds: readonly string[],
): Promise<Record<string, GroundFileData>> {
  const out: Record<string, GroundFileData> = {};
  if (fileIds.length === 0) return out;
  const repoRoot = sceneStore.getState().repoRoot;
  if (repoRoot) {
    try {
      const sources = await loadFileSourceBatch({ repoRoot, fileIds: [...fileIds] });
      for (const id of fileIds) {
        out[id] = { source: sources[id] ?? SAMPLE_SOURCES[id] ?? "" };
      }
      return out;
    } catch {
      for (const id of fileIds) {
        out[id] = { source: SAMPLE_SOURCES[id] ?? "" };
      }
      return out;
    }
  }
  for (const id of fileIds) {
    out[id] = { source: SAMPLE_SOURCES[id] ?? "" };
  }
  return out;
}
