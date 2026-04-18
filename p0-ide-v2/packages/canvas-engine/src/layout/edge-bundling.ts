import type { Rect, FileEdge, FileNode } from "../graph/types";
import type { BundledEdge, ClusterMeta } from "./types";

/**
 * Cluster-level edge bundling. Groups edges by (sourceCluster, targetCluster)
 * so a single thick "trunk" can replace N underlying file→file edges at the
 * supergalaxy LOD tier.
 *
 * This is the standard approach for large-graph visualization (cf. Holten
 * "Hierarchical Edge Bundles" 2006, adapted here to a flat cluster
 * partition rather than a dendrogram for speed).
 *
 * Output semantics:
 *   - One BundledEdge per UNORDERED pair of distinct clusters. Bidirectional
 *     edges between cluster A and cluster B merge into one trunk with count
 *     = total edges across both directions. Consumers wanting directionality
 *     should read the per-edge `edgeRoutes` for the underlying edges instead.
 *   - Intra-cluster edges (source and target in the same cluster) are
 *     dropped — they're not "cluster-level" relationships and rendering them
 *     as a zero-length trunk is a noop.
 *   - midpoint = midpoint between the two cluster rect centers.
 *
 * The bundling helper exposes the raw (fromClusterId, toClusterId, count,
 * midpoint) data so a future renderer can draw the trunk however it likes
 * (thickness ~ log(count), color by dominant edge kind, etc.).
 */

/**
 * Build a fileId → clusterId lookup given cluster metadata. A file is a
 * member of the cluster whose rect contains it. If a file's rect is not
 * contained by any cluster (e.g. top-level script files that sit outside
 * any treemap cluster), it's assigned cluster id `""` (the empty string)
 * and dropped from bundling.
 *
 * This runs once per layout build and is O(F * C) where F = file count,
 * C = cluster count. For 6k files × 140 clusters that's ~840k
 * containment checks — runs in a few ms on modern JS engines.
 */
export function buildFileToClusterMap(
  files: FileNode[],
  fileRects: Map<string, Rect>,
  clusters: ClusterMeta[],
): Map<string, string> {
  const map = new Map<string, string>();
  if (clusters.length === 0) return map;

  // Fast path: exploit the fact that ClusterMeta.id is almost always a
  // directory-path prefix of file.id (e.g. `crates/quanta-runtime` →
  // `crates/quanta-runtime/src/foo.rs`). Walk each file's path components,
  // building progressive prefixes, and look each one up in a Map<id,id>.
  // This is O(F * avgDepth) with a hash lookup per step — far cheaper
  // than the naive O(F * C) startsWith scan for C=140 clusters.
  const clusterIds = new Set<string>();
  for (const c of clusters) clusterIds.add(c.id);

  for (const file of files) {
    const parts = file.id.split("/");
    let prefix = "";
    let assigned = "";
    for (const part of parts) {
      prefix = prefix === "" ? part : `${prefix}/${part}`;
      if (clusterIds.has(prefix)) {
        assigned = prefix;
        // Don't break — a deeper cluster id (if registered) should win.
        // In practice clusters are one-level so breaking is also fine.
      }
    }
    if (assigned !== "") map.set(file.id, assigned);
  }

  // Rect-containment fallback for any files that weren't matched by path
  // (can happen with flat graphs where cluster ids aren't file-id prefixes).
  if (map.size < files.length) {
    const sortedClusters = [...clusters].sort((a, b) => b.id.length - a.id.length);
    for (const file of files) {
      if (map.has(file.id)) continue;
      const r = fileRects.get(file.id);
      if (!r) continue;
      const fx = r.x + r.w / 2;
      const fy = r.y + r.h / 2;
      for (const c of sortedClusters) {
        const cr = c.rect;
        if (fx >= cr.x && fx <= cr.x + cr.w && fy >= cr.y && fy <= cr.y + cr.h) {
          map.set(file.id, c.id);
          break;
        }
      }
    }
  }
  return map;
}

/**
 * Build bundled edges: collapse per-file edges into cluster-to-cluster
 * trunks. Returns one entry per unordered cluster pair.
 */
export function buildBundledEdges(
  edges: FileEdge[],
  fileToCluster: Map<string, string>,
  clusters: ClusterMeta[],
): BundledEdge[] {
  if (clusters.length === 0 || edges.length === 0) return [];

  const clusterById = new Map<string, ClusterMeta>();
  for (const c of clusters) clusterById.set(c.id, c);

  // Unordered-pair key: smaller id first.
  const pairKey = (a: string, b: string): string => (a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`);

  const counts = new Map<string, { from: string; to: string; count: number }>();
  for (const e of edges) {
    const a = fileToCluster.get(e.from);
    const b = fileToCluster.get(e.to);
    if (!a || !b || a === b) continue;
    const key = pairKey(a, b);
    const entry = counts.get(key);
    if (entry) {
      entry.count++;
    } else {
      counts.set(key, { from: a, to: b, count: 1 });
    }
  }

  const out: BundledEdge[] = [];
  for (const { from, to, count } of counts.values()) {
    const fromC = clusterById.get(from);
    const toC = clusterById.get(to);
    if (!fromC || !toC) continue;
    const midpoint = {
      x: (fromC.rect.x + fromC.rect.w / 2 + toC.rect.x + toC.rect.w / 2) / 2,
      y: (fromC.rect.y + fromC.rect.h / 2 + toC.rect.y + toC.rect.h / 2) / 2,
    };
    out.push({
      fromClusterId: from,
      toClusterId: to,
      count,
      midpoint,
    });
  }
  return out;
}
