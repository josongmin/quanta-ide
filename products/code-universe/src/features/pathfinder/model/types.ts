// pathfinder/model/types.ts
// ---------------------------------------------------------------
// Pure data contracts for the Pathfinding Spotlight view.
// No rendering logic. Worker-safe (no DOM types).

import type { WorkspaceGraph } from "@quanta/canvas-engine";

export interface PathfinderNode {
  /** File id */
  fileId: string;
  /** Display name (short file name) */
  fileName: string;
  /** ArchLayer from FileNode */
  layer: string;
  /** 0..1 risk score */
  riskScore: number;
  /** SVG x position (absolute, not centered) */
  x: number;
  /** SVG y position */
  y: number;
  /** Whether this node appears on at least one selected path */
  isOnPath: boolean;
  /** Bit-mask: paths[0]=bit0, paths[1]=bit1, paths[2]=bit2 */
  pathMask: number;
}

export interface PathfinderEdge {
  /** FileEdge.id */
  id: string;
  from: string;
  to: string;
  /** Whether this edge appears on at least one path */
  isOnPath: boolean;
  /** Bit-mask like PathfinderNode.pathMask */
  pathMask: number;
  /** Edge weight from FileEdge */
  weight: number;
}

export interface PathfinderLayout {
  /** Ordered paths from findPaths result */
  paths: Array<{
    nodeIds: string[];
    edgeIds: string[];
    cost: number;
    /** Assigned display color */
    pathColor: string;
  }>;
  nodes: PathfinderNode[];
  edges: PathfinderEdge[];
  source: string;
  target: string;
  truncated: boolean;
  /** True when no paths were found */
  noPath: boolean;
}

export interface BuildPathfinderLayoutOpts {
  graph: WorkspaceGraph;
  /** Canvas viewport width for column layout computation */
  width?: number;
  /** Canvas viewport height */
  height?: number;
  /**
   * If provided: use as sourceId.
   * targetId is then set to the highest-risk file not equal to sourceId.
   */
  selectedId?: string;
}
