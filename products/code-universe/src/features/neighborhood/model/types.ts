// neighborhood/model/types.ts
// Pure data contracts for the Neighborhood Halo view.

import type { WorkspaceGraph } from "@quanta/canvas-engine";

export interface NeighborhoodNode {
  /**
   * Unique key for this display item.
   * - Center / file: WorkspaceGraph FileNode.id
   * - Package hub:   "pkg:" + directory path (e.g. "pkg:src/api")
   */
  fileId: string;
  /** Short display name */
  fileName: string;
  /**
   * Radial tier:
   *   0 = center file
   *   1 = package hub node
   *   2 = individual file node (in the outer ring)
   */
  hop: number;
  /** Pre-computed polar angle in radians */
  angle: number;
  /** SVG x offset from center (0,0) */
  x: number;
  /** SVG y offset from center (0,0) */
  y: number;
  /** Circle radius in SVG units */
  radius: number;
  /** Fill color */
  color: string;
  /** 0..1 risk score (average for package hubs) */
  riskScore: number;
  /** True for package hub nodes */
  isPackageGroup: boolean;
  /** Directory path — set for package hubs */
  packageId?: string;
  /** Member file ids — set for package hubs */
  memberIds?: readonly string[];
  /** Number of files in the package */
  memberCount?: number;
  /**
   * Original hop distance from the neighborhood algorithm (1 or 2).
   * Set on file nodes (hop=2) to show the "1h" / "2h" badge.
   */
  fileHop?: number;
}

export interface NeighborhoodEdge {
  id: string;
  from: string;
  to: string;
  isHighlighted: boolean;
  severity?: string;
  /** True for structural tree edges (center→pkg, pkg→file) */
  isTreeEdge?: boolean;
}

export interface NeighborhoodLayout {
  center: string;
  nodes: NeighborhoodNode[];
  edges: NeighborhoodEdge[];
  maxHops: number;
  /** Total individual file count */
  totalNodes: number;
}

export interface BuildNeighborhoodLayoutOpts {
  graph: WorkspaceGraph;
  selectedId?: string;
  /**
   * Active symbol selection. Overrides `selectedId` when present — the
   * layout recomputes the neighborhood from symbol-level edges rather
   * than file imports, then projects each endpoint to its containing
   * file so the renderer still paints file nodes. Files outside the
   * symbol's reach are hidden.
   *
   * When `graph.symbolEdges` is absent or the symbol id doesn't resolve,
   * the builder falls back to file-tier behavior (identical to passing
   * no symbol id at all) — no empty-state surprise.
   */
  selectedSymbolId?: string | null;
}
