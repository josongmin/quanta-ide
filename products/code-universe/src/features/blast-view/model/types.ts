import type { EntityKind, EntityTree, WorkspaceGraph } from "@quanta/canvas-engine";

export type BlastDirection = "blast" | "fix";

export interface BlastRingNode {
  id: string;
  label: string;
  kind: EntityKind;
  /** Which depth ring this node belongs to */
  depth: number;
  color: string;
  /** Total edge weight from/to the root via this chain */
  weight: number;
  /** Angle in radians for polar layout */
  angle: number;
  /** Radius in SVG units */
  r: number;
  /** SVG x,y position */
  x: number;
  y: number;
}

export interface BlastRing {
  depth: number;
  nodes: BlastRingNode[];
  /** Sum of weights in this ring */
  totalWeight: number;
  /** Radius of the ring circle in SVG units */
  ringRadius: number;
  /** Fill color for the ring background — radial gradient stop */
  ringColor: string;
}

export interface BlastLayout {
  /** The root entity being analyzed */
  centerId: string;
  centerLabel: string;
  centerKind: EntityKind;
  direction: BlastDirection;
  rings: BlastRing[];
  totalAffected: number;
  overflow: number;
}

export interface BuildBlastLayoutOpts {
  tree: EntityTree;
  graph: WorkspaceGraph;
  width: number;
  height: number;
  /** Entity to blast from. Can be any kind — files within are blasted collectively. */
  centerId: string;
  direction?: BlastDirection;
  maxDepth?: number;
  /** Max nodes per ring before trimming. Defaults to 40 */
  maxNodesPerRing?: number;
}
