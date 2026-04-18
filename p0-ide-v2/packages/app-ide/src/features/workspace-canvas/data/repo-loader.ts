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
