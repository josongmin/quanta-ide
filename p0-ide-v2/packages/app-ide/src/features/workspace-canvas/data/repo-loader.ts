// MOCK — Dev-only fetcher hitting the local scanner plugin.
// Production paths should go through a `GraphSource` implementation
// (see `./graph-source.ts`) instead of calling these helpers directly.
// Kept exported for backwards compatibility with existing callers.
import type { WorkspaceGraph } from "@quanta/canvas-engine";

export interface LoadRepoResult {
  graph: WorkspaceGraph;
  stats: { totalFiles: number; skipped: number; durationMs: number };
}

export interface LoadRepoOptions {
  path: string;
  extensions?: string[];
  maxFiles?: number;
}

// Local dev server calls — short hard cap so a hung Vite plugin (file lock,
// stalled node scanner, crashed dev-server) surfaces quickly instead of
// pinning the UI on a forever-loading spinner. Background loads don't toast;
// a single session-level warning covers every failure from here.
const DEV_FETCH_TIMEOUT_MS = 10_000;

let warnedOnce = false;
function logOnce(scope: string, err: unknown): void {
  if (warnedOnce) return;
  warnedOnce = true;
  console.warn(`[repo-loader] ${scope} failed — suppressing further warnings for this session`, err);
}

// Wraps fetch with an abort-based timeout. Callers get the same `Response`
// contract they had before; on timeout the native `AbortError` propagates
// through the outer try/catch at each public helper.
async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), DEV_FETCH_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Talks to the dev-server middleware registered by vite-plugins/repo-scanner.ts.
// The server walks the filesystem, extracts functions + import edges, and
// returns a WorkspaceGraph JSON blob ready to feed into MultiFileCanvas.
export async function loadRepoGraph(opts: LoadRepoOptions): Promise<LoadRepoResult> {
  const qs = new URLSearchParams({ path: opts.path });
  if (opts.extensions?.length) qs.set("exts", opts.extensions.join(","));
  if (opts.maxFiles != null) qs.set("max", String(opts.maxFiles));

  const url = `/__repo/scan?${qs.toString()}`;
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`scan failed (${res.status}): ${body}`);
    }
    const json = await res.json() as WorkspaceGraph & { stats: LoadRepoResult["stats"] };
    const { stats, ...graph } = json;
    return { graph, stats };
  } catch (err) {
    logOnce("loadRepoGraph", err);
    throw err;
  }
}

// ── Per-file source loader ──────────────────────────────────────────
// Fetches the raw contents of a single file from the dev-server endpoint
// registered alongside /__repo/scan. `fileId` is the scanner-assigned id,
// which for scanned repos is the repo-relative path.
export interface LoadFileSourceOptions {
  repoRoot: string;
  fileId: string;
}

export async function loadFileSource(opts: LoadFileSourceOptions): Promise<string> {
  const qs = new URLSearchParams({ root: opts.repoRoot, path: opts.fileId });
  const url = `/__repo/file?${qs.toString()}`;
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`file fetch failed (${res.status}): ${body}`);
    }
    return await res.text();
  } catch (err) {
    logOnce("loadFileSource", err);
    throw err;
  }
}

// Batch version — useful when several ground cards become visible at once.
// Falls back to an empty string for any entry the server couldn't read.
export async function loadFileSourceBatch(opts: {
  repoRoot: string;
  fileIds: string[];
}): Promise<Record<string, string>> {
  try {
    const res = await fetchWithTimeout("/__repo/file/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ root: opts.repoRoot, paths: opts.fileIds }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`file batch failed (${res.status}): ${body}`);
    }
    const raw = await res.json() as Record<string, string | null>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      out[k] = v ?? "";
    }
    return out;
  } catch (err) {
    logOnce("loadFileSourceBatch", err);
    throw err;
  }
}
