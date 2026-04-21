import type { ArchLayer } from "@quanta/canvas-engine";

export interface ArchLayerNode {
  layer: ArchLayer;
  label: string;
  fileCount: number;
  totalLoc: number;
  /** Total structural edges OUTBOUND from this layer */
  outboundEdgeCount: number;
  /** Total structural edges INBOUND to this layer */
  inboundEdgeCount: number;
  /** Color for this layer — fixed palette */
  color: string;
  /** SVG x position of this column's center */
  x: number;
  /** SVG y center of this node rect */
  y: number;
  width: number;
  height: number;
}

export type FlowCategory = "allowed" | "violation";

export interface ArchFlowEdge {
  id: string;
  fromLayer: ArchLayer;
  toLayer: ArchLayer;
  category: FlowCategory;
  /** Aggregated weight = sum of all fileEdge weights on this layer pair */
  weight: number;
  /** How many individual file-level edges this represents */
  edgeCount: number;
  /** SVG path (cubic bezier) for the Sankey ribbon */
  path: string;
  /** Y center of the ribbon at the "from" side */
  fromY: number;
  /** Y center of the ribbon at the "to" side */
  toY: number;
  /** Ribbon thickness at source */
  fromThickness: number;
  /** Ribbon thickness at target */
  toThickness: number;
}

export interface ArchLayerLayout {
  nodes: ArchLayerNode[];
  edges: ArchFlowEdge[];
  totalViolations: number;
  totalAllowed: number;
  violatingPairs: Array<{ fromLayer: ArchLayer; toLayer: ArchLayer; count: number }>;
}

export interface BuildArchLayerLayoutOpts {
  graph: import("@quanta/canvas-engine").WorkspaceGraph;
  width: number;
  height: number;
}
