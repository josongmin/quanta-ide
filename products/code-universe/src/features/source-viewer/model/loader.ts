// Source loader
// --------------------------------------------------------------------
// Batched reader for file source text. Visible file cards enter the
// building-tier overlay in bursts — one per on-screen entity — so we
// coalesce their requests into a single POST to `/__repo/file/batch`.
// The dev-server plugin (p0-ide-v2/vite-plugins/repo-scanner) answers
// with `{ [fileId]: string | null }`.
//
// Rationale mirrors v1's `use-ground-data-batch`: one microtask window
// per repoRoot collects every fileId the overlay mounts, fires a
// single fetch, then fans the results back out to the cache store.
// At ~60 on-screen files (the practical building-tier ceiling) this
// cuts the fetch count from 60 to 1 without introducing a visible
// latency floor.

import { getRepoRoot } from "../../../shared/api/repo-root";

const FETCH_TIMEOUT_MS = 10_000;

export type SourceResult =
  | { ok: true; source: string }
  | { ok: false; reason: "no-root" | "empty" | "error"; error?: Error };

type Resolver = (r: SourceResult) => void;

interface PendingBatch {
  root: string;
  ids: Map<string, Resolver[]>;
  scheduled: boolean;
}

// Keyed by root so a host that swaps repos doesn't cross-contaminate
// batches. In practice there's only ever one root at a time, but the
// guarantee is cheap.
const batches = new Map<string, PendingBatch>();

function scheduleFlush(batch: PendingBatch): void {
  if (batch.scheduled) return;
  batch.scheduled = true;
  queueMicrotask(() => void flush(batch));
}

async function flush(batch: PendingBatch): Promise<void> {
  const ids = [...batch.ids.keys()];
  const resolvers = new Map(batch.ids);
  batches.delete(batch.root);

  if (ids.length === 0) return;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch("/__repo/file/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ root: batch.root, paths: ids }),
      signal: ctrl.signal,
    }).finally(() => clearTimeout(timer));

    if (!res.ok) {
      const err = new Error(`source batch failed (${res.status})`);
      for (const list of resolvers.values()) {
        for (const r of list) r({ ok: false, reason: "error", error: err });
      }
      return;
    }

    const raw = (await res.json()) as Record<string, string | null>;
    for (const [id, list] of resolvers) {
      const source = raw[id];
      const result: SourceResult =
        source == null || source === ""
          ? { ok: false, reason: "empty" }
          : { ok: true, source };
      for (const r of list) r(result);
    }
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    for (const list of resolvers.values()) {
      for (const r of list) r({ ok: false, reason: "error", error: e });
    }
  }
}

export function requestSource(fileId: string): Promise<SourceResult> {
  const root = getRepoRoot();
  if (!root) return Promise.resolve({ ok: false, reason: "no-root" });

  return new Promise<SourceResult>(resolve => {
    let batch = batches.get(root);
    if (!batch) {
      batch = { root, ids: new Map(), scheduled: false };
      batches.set(root, batch);
    }
    const list = batch.ids.get(fileId);
    if (list) list.push(resolve);
    else batch.ids.set(fileId, [resolve]);
    scheduleFlush(batch);
  });
}
