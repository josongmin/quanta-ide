import type { WorkspaceGraph, FileNode } from "./types";
import type { WorkspaceMetrics, FileMetrics } from "./metrics";

// "Start here" ranking — a single ordered list of files a newcomer should
// open first. Mirrors the tri-signal model from Sourcegraph's repo-intel
// overview, DeepSource's "entry points" board and CodeScene's hotspot
// ranking: combine centrality (how wired), entry-point-ness (how often
// the file is a program/module root), and risk (how suspicious static
// analysis finds it). Activity (git churn) would be the canonical fourth
// signal but we don't carry git data yet — the blend here is intentionally
// heuristic so adding activity later is a weight-change, not a rewrite.

export interface StartHereEntry {
  fileId: string;
  score: number;
  breakdown: {
    centrality: number;
    entryPoint: number;
    risk: number;
  };
  rank: number;
}

// Weights chosen to surface "the file I must understand" first:
//   - Centrality dominates (0.45) because a hub file is almost always the
//     right next click — it's literally where code flows through.
//   - Entry points (0.30) compete closely; a 10-degree router file should
//     still beat a 50-degree deep-utility that only gets imported a lot.
//   - Risk (0.25) is the "interesting anyway" kicker; even a small isolated
//     file with a taint warning should surface, but it shouldn't drown the
//     hubs that newcomers normally need first.
const W_CENTRALITY = 0.45;
const W_ENTRY_POINT = 0.30;
const W_RISK = 0.25;

const DEFAULT_TOP_N = 10;

// Patterns matched against the file's *basename* (case-insensitive). Each
// pattern scores differently because not all "entry points" are equal:
//   - main/__init__/index score 1.0 — canonical program or package roots.
//   - app/server score 0.85 — framework roots (Express, FastAPI, Vite).
//   - api/router/route/controllers basenames score 0.7 — sub-app roots.
// Directory-based boosts (routes/, controllers/, pages/, handlers/) add
// a floor of 0.5 regardless of basename so framework layouts still
// surface.
const ENTRY_PATTERNS_BASENAME: Array<{ re: RegExp; score: number }> = [
  { re: /^main\.[a-z0-9]+$/i, score: 1.0 },
  { re: /^__init__\.py$/i, score: 1.0 },
  { re: /^index\.[a-z0-9]+$/i, score: 1.0 },
  { re: /^app\.[a-z0-9]+$/i, score: 0.85 },
  { re: /^server\.[a-z0-9]+$/i, score: 0.85 },
  { re: /^api\.[a-z0-9]+$/i, score: 0.7 },
  { re: /^router\.[a-z0-9]+$/i, score: 0.7 },
  { re: /^routes\.[a-z0-9]+$/i, score: 0.7 },
];

// Directory segment boost — applied when any path segment matches. Keeps
// files under `src/routes/` scoring > 0 even if the basename is arbitrary.
const ENTRY_DIRS: ReadonlySet<string> = new Set([
  "routes",
  "controllers",
  "pages",
  "handlers",
  "endpoints",
]);
const ENTRY_DIR_FLOOR = 0.5;

function entryPointScore(file: FileNode): number {
  const parts = file.id.split("/");
  const basename = parts[parts.length - 1] ?? file.id;
  let best = 0;
  for (const p of ENTRY_PATTERNS_BASENAME) {
    if (p.re.test(basename) && p.score > best) best = p.score;
  }
  for (let i = 0; i < parts.length - 1; i++) {
    if (ENTRY_DIRS.has(parts[i].toLowerCase())) {
      if (ENTRY_DIR_FLOOR > best) best = ENTRY_DIR_FLOOR;
    }
  }
  return best;
}

function centralityScore(m: FileMetrics | undefined, maxDegree: number): number {
  if (!m) return 0;
  if (m.betweennessRank !== undefined) {
    // betweennessRank is already normalized 0..1 by metrics.ts.
    return m.betweennessRank;
  }
  if (maxDegree <= 0) return 0;
  return m.degree / maxDegree;
}

function riskScore(file: FileNode): number {
  const r = file.riskScore / 100;
  if (r < 0) return 0;
  if (r > 1) return 1;
  return r;
}

/**
 * Rank files a newcomer should look at first. Stable: ties break by fileId
 * alphabetically so reruns on the same graph produce the same ordering
 * (critical for the HUD — list jittering on pan would be visible).
 */
export function rankStartHere(
  graph: Pick<WorkspaceGraph, "files" | "fileEdges">,
  metrics: WorkspaceMetrics,
  topN: number = DEFAULT_TOP_N,
): StartHereEntry[] {
  if (graph.files.length === 0) return [];

  // maxDegree is the normalization baseline when betweenness is absent.
  // Computed once, not per file, so the hot loop is O(N) not O(N^2).
  let maxDegree = 0;
  for (const fm of metrics.perFile.values()) {
    if (fm.degree > maxDegree) maxDegree = fm.degree;
  }

  const scored: StartHereEntry[] = [];
  for (const file of graph.files) {
    const fm = metrics.perFile.get(file.id);
    const centrality = centralityScore(fm, maxDegree);
    const entryPoint = entryPointScore(file);
    const risk = riskScore(file);
    const score =
      W_CENTRALITY * centrality +
      W_ENTRY_POINT * entryPoint +
      W_RISK * risk;
    scored.push({
      fileId: file.id,
      score,
      breakdown: { centrality, entryPoint, risk },
      rank: 0,
    });
  }

  scored.sort((a, b) => {
    const d = b.score - a.score;
    if (d !== 0) return d;
    return a.fileId < b.fileId ? -1 : a.fileId > b.fileId ? 1 : 0;
  });

  const limit = Math.min(topN, scored.length);
  const out: StartHereEntry[] = [];
  for (let i = 0; i < limit; i++) {
    const e = scored[i];
    e.rank = i + 1;
    out.push(e);
  }
  return out;
}
