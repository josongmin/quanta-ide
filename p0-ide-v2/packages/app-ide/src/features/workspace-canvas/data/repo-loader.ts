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

// Talks to the dev-server middleware registered by vite-plugins/repo-scanner.ts.
// The server walks the filesystem, extracts functions + import edges, and
// returns a WorkspaceGraph JSON blob ready to feed into MultiFileCanvas.
export async function loadRepoGraph(opts: LoadRepoOptions): Promise<LoadRepoResult> {
  const qs = new URLSearchParams({ path: opts.path });
  if (opts.extensions?.length) qs.set("exts", opts.extensions.join(","));
  if (opts.maxFiles != null) qs.set("max", String(opts.maxFiles));

  const url = `/__repo/scan?${qs.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`scan failed (${res.status}): ${body}`);
  }
  const json = await res.json() as WorkspaceGraph & { stats: LoadRepoResult["stats"] };
  const { stats, ...graph } = json;
  return { graph, stats };
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
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`file fetch failed (${res.status}): ${body}`);
  }
  return res.text();
}

// Batch version — useful when several ground cards become visible at once.
// Falls back to an empty string for any entry the server couldn't read.
export async function loadFileSourceBatch(opts: {
  repoRoot: string;
  fileIds: string[];
}): Promise<Record<string, string>> {
  const res = await fetch("/__repo/file/batch", {
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
}
