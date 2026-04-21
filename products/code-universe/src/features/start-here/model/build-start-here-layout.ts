import { computeWorkspaceMetrics, rankStartHere } from "@quanta/canvas-engine";
import type { BuildStartHereLayoutOpts, StartHereLayout, StartHereRow } from "./types";

const DEFAULT_TOP_N = 12;

/** Map a 0..1 score to a color along green→yellow→red spectrum. */
function scoreToRingColor(score: number): string {
  // score near 1 = highest priority = we use a clear/accessible teal-green
  // score near 0 = less critical = neutral gray
  // Risk component tilts toward orange/red
  const hue = 145 - score * 125; // 145 (teal-green) → 20 (orange-red)
  return `hsl(${hue}deg, 60%, 48%)`;
}

function basenameOf(fileId: string): string {
  const idx = fileId.lastIndexOf("/");
  return idx >= 0 ? fileId.slice(idx + 1) : fileId;
}

function describeEntry(centrality: number, entryPoint: number, risk: number): string {
  if (risk > 0.7) return "Risk hotspot";
  if (entryPoint > 0.5) return "Package entry point";
  if (centrality > 0.5) return "High-traffic hub";
  return "Structural node";
}

const EMPTY_LAYOUT: StartHereLayout = { rows: [], totalFiles: 0 };

export function buildStartHereLayout(opts: BuildStartHereLayoutOpts): StartHereLayout {
  const { graph, topN = DEFAULT_TOP_N } = opts;

  if (graph.files.length === 0) return EMPTY_LAYOUT;

  // Step 1: workspace metrics
  let metrics;
  try {
    metrics = computeWorkspaceMetrics(graph);
  } catch {
    return EMPTY_LAYOUT;
  }
  if (metrics.fileCount === 0) return EMPTY_LAYOUT;

  // Step 2: rank start-here entries
  let entries;
  try {
    entries = rankStartHere(graph, metrics, topN);
  } catch {
    return EMPTY_LAYOUT;
  }
  if (entries.length === 0) {
    return { rows: [], totalFiles: graph.files.length };
  }

  // Step 3: map to StartHereRow
  const rows: StartHereRow[] = entries.map((entry) => {
    const { centrality, entryPoint, risk } = entry.breakdown;
    return {
      rank: entry.rank,
      fileId: entry.fileId,
      fileName: basenameOf(entry.fileId),
      score: entry.score,
      centrality,
      entryPoint,
      risk,
      ringColor: scoreToRingColor(entry.score),
      description: describeEntry(centrality, entryPoint, risk),
    };
  });

  return { rows, totalFiles: graph.files.length };
}
