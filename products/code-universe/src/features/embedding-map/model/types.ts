// Semantic Embedding Map — type contracts
// --------------------------------------------------------------------
// Each package (galaxy entity) is represented as a point in 2D space
// based on its structural characteristics (fan-in, fan-out, risk,
// complexity, etc.). Similar packages cluster together in a proximity
// map. Projection is deterministic — no LLM, no Math.random.
//
// The layout is pure-data-in / pure-data-out: `buildEmbeddingLayout`
// returns an `EmbeddingLayout` and the SVG renderer paints from that.
// No tree/graph traversal happens in React.

import type { EntityKind } from "@quanta/canvas-engine";

/** One projected entity in 2D embedding space. */
export interface EmbeddingPoint {
  id: string;
  label: string;
  kind: EntityKind;
  /** 2D projected position in normalized space (-1..1 each axis) */
  x: number;
  y: number;
  color: string;
  /** Radius in SVG units proportional to loc/fileCount */
  radius: number;
  /** Rich sublabel: "12 files · risk 0.6 · fanIn 8" */
  sublabel: string;
  /** Which cluster group this point was assigned to (k-means-lite) */
  clusterId: number;
}

/** A k-means cluster with its centroid and representative label. */
export interface EmbeddingCluster {
  id: number;
  /** id of the representative point (largest radius in cluster) */
  centroidId: string;
  label: string;
  /** Centroid of cluster positions */
  cx: number;
  cy: number;
}

export interface EmbeddingLayout {
  points: EmbeddingPoint[];
  clusters: EmbeddingCluster[];
  /** How many entities were trimmed due to maxPoints */
  overflow: number;
}

export interface BuildEmbeddingLayoutOpts {
  tree: import("@quanta/canvas-engine").EntityTree;
  graph: import("@quanta/canvas-engine").WorkspaceGraph;
  width: number;
  height: number;
  /** Which kind to embed — defaults to "galaxy" */
  pointKind?: "galaxy" | "building";
  /** Scope to subtree — null = workspace root */
  scopeId?: string | null;
  /** Max points before trimming — defaults to 100 */
  maxPoints?: number;
  /** Number of k-means clusters — defaults to min(5, ceil(sqrt(n))) */
  numClusters?: number;
}
