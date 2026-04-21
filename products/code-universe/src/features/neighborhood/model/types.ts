// neighborhood/model/types.ts
// ---------------------------------------------------------------
// Pure data contracts for the Neighborhood Halo view.
// No rendering logic. Worker-safe (no DOM types).

import type { WorkspaceGraph } from "@quanta/canvas-engine";

export interface NeighborhoodNode {
  /** File id (WorkspaceGraph FileNode.id) */
  fileId: string;
  /** Display name (short file name) */
  fileName: string;
  /** Hop distance from center: 0 = center, 1 = direct, 2 = two-hop */
  hop: number;
  /** Pre-computed polar angle in radians */
  angle: number;
  /** SVG x offset from center (0,0) */
  x: number;
  /** SVG y offset from center (0,0) */
  y: number;
  /** Circle radius in SVG units */
  radius: number;
  /** Resolved fill color (hex string) from risk score / role */
  color: string;
  /** 0..1 risk score from FileNode.riskScore */
  riskScore: number;
}

export interface NeighborhoodEdge {
  /** FileEdge.id */
  id: string;
  from: string;
  to: string;
  /** True when either endpoint is the center or has high severity */
  isHighlighted: boolean;
  /** EdgeSeverity from source FileEdge (undefined = structural) */
  severity?: string;
}

export interface NeighborhoodLayout {
  /** FileId of center node */
  center: string;
  nodes: NeighborhoodNode[];
  edges: NeighborhoodEdge[];
  maxHops: number;
  totalNodes: number;
}

export interface BuildNeighborhoodLayoutOpts {
  graph: WorkspaceGraph;
  /** If provided, use as center. Otherwise: file with highest total edge count. */
  selectedId?: string;
}
