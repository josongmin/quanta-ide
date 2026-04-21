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

// ── Mock data (shown when graph has no files) ─────────────────────────

function mockStartHereLayout(): StartHereLayout {
  const entries = [
    { fileId: "src/store/appStore.ts",       centrality: 0.92, entryPoint: 0.80, risk: 0.45 },
    { fileId: "src/domain/userService.ts",   centrality: 0.78, entryPoint: 0.60, risk: 0.62 },
    { fileId: "src/api/client.ts",           centrality: 0.65, entryPoint: 0.85, risk: 0.38 },
    { fileId: "src/components/App.tsx",      centrality: 0.55, entryPoint: 0.90, risk: 0.30 },
    { fileId: "src/domain/orderService.ts",  centrality: 0.70, entryPoint: 0.45, risk: 0.70 },
    { fileId: "src/infra/db.ts",             centrality: 0.48, entryPoint: 0.35, risk: 0.72 },
    { fileId: "src/hooks/useStore.ts",       centrality: 0.60, entryPoint: 0.55, risk: 0.28 },
    { fileId: "src/utils/logger.ts",         centrality: 0.42, entryPoint: 0.70, risk: 0.18 },
    { fileId: "src/auth/authService.ts",     centrality: 0.50, entryPoint: 0.50, risk: 0.55 },
    { fileId: "src/store/cartStore.ts",      centrality: 0.38, entryPoint: 0.40, risk: 0.48 },
  ];
  const rows: StartHereRow[] = entries.map((e, i) => {
    const score = (e.centrality * 0.4 + e.entryPoint * 0.4 + (1 - e.risk) * 0.2);
    const hue = 145 - score * 125;
    return {
      rank: i + 1,
      fileId: e.fileId,
      fileName: e.fileId.split("/").pop() ?? e.fileId,
      score,
      centrality: e.centrality,
      entryPoint: e.entryPoint,
      risk: e.risk,
      ringColor: `hsl(${hue}deg, 60%, 48%)`,
      description: e.risk > 0.7 ? "Risk hotspot" : e.entryPoint > 0.7 ? "Package entry point" : e.centrality > 0.7 ? "High-traffic hub" : "Structural node",
    };
  });
  // Sort by score desc, re-rank
  rows.sort((a, b) => b.score - a.score);
  rows.forEach((r, i) => { r.rank = i + 1; });
  return { rows, totalFiles: 48 };
}

export function buildStartHereLayout(opts: BuildStartHereLayoutOpts): StartHereLayout {
  const { graph, topN = DEFAULT_TOP_N } = opts;

  if (graph.files.length === 0) return mockStartHereLayout();

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
    return mockStartHereLayout();
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
