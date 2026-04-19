import type { EdgeKind, EdgeLayer, EdgeSeverity, FileEdge } from "../graph/types";
import { deriveEdgeLayer } from "../graph/types";
import type { BezierRoute, ClusterMeta } from "./types";

// Cluster-level edge aggregation — the directional sibling of
// `edge-bundling.ts`. Bundling collapses every cluster-pair into a single
// unordered trunk (good for "how wired are these two modules?"). This
// aggregator keeps (from, to, kind) buckets so supergalaxy-tier renderers
// can show kind-coloured directional super-edges (call vs taint vs impact).
//
// Directional decision: EVERY kind stays directional in this pass. A→B and
// B→A are distinct buckets even when the kind is conceptually symmetric
// (e.g. `reference`). Rationale:
//   - `import` / `call` / `taint-propagation` / `impact` / `dataflow` /
//     `dependency` / `blast` / `diff` / `cfg` / `pdg` / `effect` / `alias`
//     / `inheritance` / `witness` — directional by analyzer definition.
//   - `reference`, `sanitizer`, `race`, `cycle`, `finding` — less obviously
//     so, but treating them directionally costs nothing (we just produce
//     two super-edges instead of one) and keeps the rule set uniform. A
//     future "symmetric" flag on EdgeKind could coalesce them, but until
//     then uniform directional aggregation is the cheapest correct default.

export interface ClusterEdge {
  /** Deterministic `${fromClusterId}→${toClusterId}:${kind}` so callers can key React lists or diff across rebuilds. */
  id: string;
  fromClusterId: string;
  toClusterId: string;
  /** Dominant kind of the bucket — here, always the bucket's kind since we bucket by kind. */
  kind: EdgeKind;
  /** Derived via `deriveEdgeLayer(kind)`. Stored once so renderers don't re-derive per frame. */
  layer: EdgeLayer;
  /** Number of underlying FileEdges that contributed to this bucket. */
  count: number;
  /** Worst severity among contributing edges (missing severity treated as "low"). Undefined iff no contributor had one. */
  maxSeverity?: EdgeSeverity;
  /** Optional layout-assigned bezier route. Aggregator leaves it unset; the layout producer attaches it after cluster rects are known. */
  route?: BezierRoute;
}

export interface ClusterEdgeAggregateInput {
  readonly fileEdges: readonly FileEdge[];
  /** fileId → clusterId. Callers derive this from `WorkspaceLayout.clusters`; files outside any cluster should be omitted. */
  readonly clusterOf: Map<string, string>;
}

// Severity rank duplicated here rather than imported from canvas-pixi: the
// engine package must stay renderer-free. Matches
// `canvas-pixi/.../colors.ts#SEVERITY_RANK` — if one changes, change both.
const SEVERITY_RANK: Record<EdgeSeverity, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};
const SEVERITY_BY_RANK: readonly EdgeSeverity[] = ["low", "medium", "high", "critical"];

interface Bucket {
  fromClusterId: string;
  toClusterId: string;
  kind: EdgeKind;
  count: number;
  maxSeverityRank: number; // -1 when no contributor carried a severity
}

/**
 * Aggregate file-level edges into directional cluster-cluster super-edges,
 * bucketed by (fromClusterId, toClusterId, kind). Self-loops (both ends in
 * the same cluster) are skipped — they don't describe cross-module flow.
 *
 * Complexity: O(E) over fileEdges + O(B) over buckets for the final pass.
 */
export function aggregateClusterEdges(input: ClusterEdgeAggregateInput): ClusterEdge[] {
  const { fileEdges, clusterOf } = input;
  if (fileEdges.length === 0 || clusterOf.size === 0) return [];

  // Key shape keeps `kind` last so deterministic id ordering matches the
  // exported `ClusterEdge.id` below (assists debugging / snapshot tests).
  const buckets = new Map<string, Bucket>();

  for (const e of fileEdges) {
    const from = clusterOf.get(e.from);
    const to = clusterOf.get(e.to);
    if (!from || !to || from === to) continue;
    const key = `${from}\u0000${to}\u0000${e.kind}`;
    const existing = buckets.get(key);
    const sevRank = e.severity !== undefined ? SEVERITY_RANK[e.severity] : -1;
    if (existing) {
      existing.count++;
      if (sevRank > existing.maxSeverityRank) existing.maxSeverityRank = sevRank;
    } else {
      buckets.set(key, {
        fromClusterId: from,
        toClusterId: to,
        kind: e.kind,
        count: 1,
        maxSeverityRank: sevRank,
      });
    }
  }

  const out: ClusterEdge[] = [];
  for (const b of buckets.values()) {
    const rank = b.maxSeverityRank;
    // Missing severity on every contributor → undefined; otherwise fall back
    // to "low" for the -1 sentinel so the field matches the SEVERITY_RANK
    // vocabulary. Callers that want "treat undefined as low" can apply it.
    const maxSeverity: EdgeSeverity | undefined =
      rank < 0 ? undefined : SEVERITY_BY_RANK[rank];
    out.push({
      id: `${b.fromClusterId}\u2192${b.toClusterId}:${b.kind}`,
      fromClusterId: b.fromClusterId,
      toClusterId: b.toClusterId,
      kind: b.kind,
      layer: deriveEdgeLayer(b.kind),
      count: b.count,
      maxSeverity,
    });
  }
  return out;
}

/**
 * Build a `clusterOf` map from a file→rect map plus the cluster metadata
 * the layout produced. Mirrors `buildFileToClusterMap` from edge-bundling,
 * kept here as a thin convenience so callers don't have to import two
 * helpers for the aggregate path.
 *
 * Delegates to the same prefix-match-then-rect-contain strategy used for
 * bundling; duplicating it once more would drift.
 */
export { buildFileToClusterMap } from "./edge-bundling";

/**
 * Convenience: attach center-to-center bezier routes to a cluster-edge
 * array given cluster metadata. The route is a 1/3-control-points bezier
 * between the two cluster rect centers — same shape/field set as the
 * per-file `BezierRoute` in `WorkspaceLayout.edgeRoutes`, so renderers can
 * reuse bezier sampling code unchanged.
 *
 * Returns the same array (mutated in place) so callers can chain:
 *   `layout.clusterEdges = routeClusterEdges(aggregateClusterEdges(...), clusters)`
 */
export function routeClusterEdges(
  edges: ClusterEdge[],
  clusters: readonly ClusterMeta[],
): ClusterEdge[] {
  if (edges.length === 0 || clusters.length === 0) return edges;
  const rectById = new Map<string, ClusterMeta["rect"]>();
  for (const c of clusters) rectById.set(c.id, c.rect);
  for (const e of edges) {
    const a = rectById.get(e.fromClusterId);
    const b = rectById.get(e.toClusterId);
    if (!a || !b) continue;
    const x1 = a.x + a.w / 2;
    const y1 = a.y + a.h / 2;
    const x2 = b.x + b.w / 2;
    const y2 = b.y + b.h / 2;
    // 1/3 control points lift the curve gently off a straight line so
    // multiple super-edges between the same pair of clusters (different
    // kinds) don't stack into a single visually-indistinguishable stroke.
    const dx = (x2 - x1) / 3;
    const dy = (y2 - y1) / 3;
    e.route = {
      x1, y1,
      cx1: x1 + dx, cy1: y1 + dy,
      cx2: x2 - dx, cy2: y2 - dy,
      x2, y2,
    };
  }
  return edges;
}
