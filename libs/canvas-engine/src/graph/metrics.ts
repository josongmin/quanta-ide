import type { WorkspaceGraph } from "./types";

// Graph-theoretic centrality metrics. Produces degree / in-degree / out-degree
// for every file plus (optionally) normalized betweenness centrality so the
// galaxy tier can scale "hub" dots and the HUD can rank files by importance.
//
// Betweenness is computed with Brandes' algorithm (Brandes, Ulrik. "A Faster
// Algorithm for Betweenness Centrality." Journal of Mathematical Sociology
// 25(2):163–177, 2001). Exact on small graphs; for large graphs (>500 nodes)
// we approximate via source-sampling: pick `sampleSize = min(128, N)` random
// source nodes and accumulate only their partial dependencies. Scaling
// partial sums by `N / sampleSize` restores magnitudes comparable to the
// exact run (Bader et al., 2007). The ranking is what matters for our UI —
// we only expose the sort order via `topByBetweenness`, not absolute values.

export interface FileMetrics {
  inDegree: number;                  // # incoming edges
  outDegree: number;                 // # outgoing edges
  degree: number;                    // inDegree + outDegree
  betweennessRank?: number;          // 0..1 normalized, higher = more central
}

export interface WorkspaceMetrics {
  perFile: Map<string, FileMetrics>;
  topByDegree: string[];             // fileIds sorted descending, capped at 50
  topByBetweenness: string[];        // same, only if computeBetweenness was true
  /** # files considered — equals graph.files.length. */
  fileCount: number;
  /** # directed edges considered — equals graph.fileEdges.length. */
  edgeCount: number;
  /** Elapsed ms for the full compute. */
  computeMs: number;
  /** True when betweenness used sampling instead of running Brandes exactly. */
  betweennessSampled: boolean;
}

export interface ComputeMetricsOptions {
  /** When true, run Brandes (or a sampled approximation) for betweenness. */
  computeBetweenness?: boolean;
  /**
   * Override the sampling threshold. Default: 500. Graphs at or below this
   * size run exact Brandes regardless of `sampleSize`.
   */
  exactBetweennessThreshold?: number;
  /**
   * Override the sample size for approximate betweenness. Default:
   * min(128, node count). Only used when N > threshold.
   */
  sampleSize?: number;
  /**
   * Max #files returned in `topByDegree` / `topByBetweenness`. Default 50.
   */
  topK?: number;
  /**
   * Deterministic seed for the sampler. Default: 1 (so repeated runs are
   * stable across sessions — important for the HUD ordering to not jitter).
   */
  sampleSeed?: number;
}

const DEFAULT_EXACT_BETWEENNESS_THRESHOLD = 500;
const DEFAULT_SAMPLE_CAP = 128;
const DEFAULT_TOP_K = 50;

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

// Mulberry32 PRNG — tiny, deterministic, enough entropy for sampling source
// nodes. Avoids pulling in a dependency and keeps betweenness deterministic
// across runs with the same seed.
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Compute centrality metrics for a workspace graph. Degree counts are O(V+E)
 * and always run. Betweenness is gated behind `computeBetweenness` because it
 * costs O(V * (V + E)) exactly (Brandes 2001) — affordable up to ~500 nodes
 * but we fall back to sampling beyond that.
 */
export function computeWorkspaceMetrics(
  graph: Pick<WorkspaceGraph, "files" | "fileEdges">,
  opts: ComputeMetricsOptions = {},
): WorkspaceMetrics {
  const t0 = now();
  const computeBetweenness = opts.computeBetweenness ?? false;
  const topK = opts.topK ?? DEFAULT_TOP_K;
  const exactThreshold = opts.exactBetweennessThreshold ?? DEFAULT_EXACT_BETWEENNESS_THRESHOLD;
  const sampleSeed = opts.sampleSeed ?? 1;

  // ── degree pass — pure counting, O(E) ─────────────────────────────
  const perFile = new Map<string, FileMetrics>();
  for (const f of graph.files) {
    perFile.set(f.id, { inDegree: 0, outDegree: 0, degree: 0 });
  }
  for (const e of graph.fileEdges) {
    const from = perFile.get(e.from);
    if (from) {
      from.outDegree += 1;
      from.degree += 1;
    }
    const to = perFile.get(e.to);
    if (to) {
      to.inDegree += 1;
      to.degree += 1;
    }
  }

  // topByDegree — capped O(N log N) sort. Stable: ties broken by file id
  // so the HUD ordering doesn't jitter between runs.
  const topByDegree = [...perFile.entries()]
    .sort((a, b) => {
      const d = b[1].degree - a[1].degree;
      if (d !== 0) return d;
      return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
    })
    .slice(0, topK)
    .map(([id]) => id);

  // ── betweenness (optional) ────────────────────────────────────────
  const topByBetweenness: string[] = [];
  let betweennessSampled = false;

  if (computeBetweenness && graph.files.length > 0) {
    // Build adjacency once — undirected (matches neighborhood semantics and
    // the intuition most users have when they say "central file").
    const adj = new Map<string, string[]>();
    for (const f of graph.files) adj.set(f.id, []);
    for (const e of graph.fileEdges) {
      adj.get(e.from)?.push(e.to);
      adj.get(e.to)?.push(e.from);
    }

    const nodes = graph.files.map(f => f.id);
    const N = nodes.length;
    const sampleCap = Math.min(opts.sampleSize ?? DEFAULT_SAMPLE_CAP, N);
    betweennessSampled = N > exactThreshold;

    let sources: string[];
    if (betweennessSampled) {
      const rng = makeRng(sampleSeed);
      // Reservoir-free shuffle of indices; we only need the first `sampleCap`.
      const idxs = Array.from({ length: N }, (_, i) => i);
      for (let i = 0; i < sampleCap; i++) {
        const j = i + Math.floor(rng() * (N - i));
        const tmp = idxs[i];
        idxs[i] = idxs[j];
        idxs[j] = tmp;
      }
      sources = idxs.slice(0, sampleCap).map(i => nodes[i]);
    } else {
      sources = nodes;
    }

    // Brandes' SSSP-based accumulation.
    const cb = new Map<string, number>();
    for (const id of nodes) cb.set(id, 0);

    for (const s of sources) {
      // Single-source shortest paths on an unweighted graph → BFS.
      const stack: string[] = [];
      const preds = new Map<string, string[]>();
      const sigma = new Map<string, number>();
      const dist = new Map<string, number>();
      for (const v of nodes) {
        preds.set(v, []);
        sigma.set(v, 0);
        dist.set(v, -1);
      }
      sigma.set(s, 1);
      dist.set(s, 0);

      const queue: string[] = [s];
      let head = 0;
      while (head < queue.length) {
        const v = queue[head++];
        stack.push(v);
        const neigh = adj.get(v);
        if (!neigh) continue;
        const dv = dist.get(v)!;
        for (const w of neigh) {
          if (dist.get(w) === -1) {
            dist.set(w, dv + 1);
            queue.push(w);
          }
          if (dist.get(w) === dv + 1) {
            sigma.set(w, (sigma.get(w) ?? 0) + (sigma.get(v) ?? 0));
            preds.get(w)!.push(v);
          }
        }
      }

      // Accumulation — iterate in reverse BFS order.
      const delta = new Map<string, number>();
      for (const v of nodes) delta.set(v, 0);
      while (stack.length > 0) {
        const w = stack.pop()!;
        const dw = delta.get(w)!;
        const sw = sigma.get(w) ?? 0;
        for (const v of preds.get(w)!) {
          const sv = sigma.get(v) ?? 0;
          const dv = delta.get(v)!;
          const inc = sw > 0 ? (sv / sw) * (1 + dw) : 0;
          delta.set(v, dv + inc);
        }
        if (w !== s) {
          cb.set(w, (cb.get(w) ?? 0) + dw);
        }
      }
    }

    // Scale sampled partial sums so magnitudes are comparable to the exact
    // run. Won't affect *ranking* (which is what we expose) but keeps the
    // normalized `betweennessRank` values within a familiar range.
    if (betweennessSampled && sources.length > 0) {
      const scale = N / sources.length;
      for (const [k, v] of cb) cb.set(k, v * scale);
    }

    // Normalize to [0, 1]. For an undirected graph, max possible BC is
    // (N-1)(N-2); we simply divide by the observed maximum so the HUD
    // shows a 0..1 band regardless of graph size.
    let maxCb = 0;
    for (const v of cb.values()) if (v > maxCb) maxCb = v;
    if (maxCb > 0) {
      for (const [k, v] of cb) {
        const m = perFile.get(k);
        if (m) m.betweennessRank = v / maxCb;
      }
    } else {
      for (const m of perFile.values()) m.betweennessRank = 0;
    }

    // topByBetweenness — tie-break by id for determinism.
    const ranked = [...perFile.entries()]
      .sort((a, b) => {
        const d = (b[1].betweennessRank ?? 0) - (a[1].betweennessRank ?? 0);
        if (d !== 0) return d;
        return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
      })
      .slice(0, topK)
      .map(([id]) => id);
    topByBetweenness.push(...ranked);
  }

  const computeMs = now() - t0;

  return {
    perFile,
    topByDegree,
    topByBetweenness,
    fileCount: graph.files.length,
    edgeCount: graph.fileEdges.length,
    computeMs,
    betweennessSampled,
  };
}
