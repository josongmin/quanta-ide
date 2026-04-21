// Service Topology — type contracts
// --------------------------------------------------------------------
// Groups files by their package prefix (first path segment) and maps
// cross-package dependencies as service edges. The result is a static
// 3-node SVG diagram with bezier-curved edges.

import type { ArchLayer } from "@quanta/canvas-engine";

/** One service node in the topology diagram. */
export interface ServiceNode {
  /** Matches NamedGraph.graphId — e.g. "canvas-engine" */
  graphId: string;
  /** Human-readable name */
  label: string;
  /** Dominant CSS hex color for this service */
  color: string;
  fileCount: number;
  /** Total lines of code across all files */
  loc: number;
  /** Mean risk score across files */
  riskScore: number;
  /** Most common ArchLayer among this service's files */
  archLayer: ArchLayer;
  /** SVG center position */
  x: number;
  y: number;
  /** Circle radius proportional to sqrt(fileCount) */
  radius: number;
  /** Layer breakdown: percentage of files per ArchLayer (0..1) */
  layerBreakdown: Partial<Record<ArchLayer, number>>;
}

/** One directed dependency edge between services. */
export interface ServiceEdge {
  /** Source graphId */
  from: string;
  /** Target graphId */
  to: string;
  /** Summed weight of all cross-package file edges */
  weight: number;
  /** Most common edge kind in the source file-edges */
  kind: "rpc" | "api-call" | "queue" | "shared-db";
  /** Always true — all service edges cross package boundaries */
  isCrossGraph: true;
  /** CSS hex color derived from kind */
  color: string;
  /** SVG cubic bezier path data */
  path: string;
}

export interface ServiceTopoLayout {
  nodes: ServiceNode[];
  edges: ServiceEdge[];
  /** Total file count across all packages */
  totalFiles: number;
}

export interface BuildServiceTopoLayoutOpts {
  graph: import("@quanta/canvas-engine").WorkspaceGraph;
  /** SVG canvas width — defaults to 800 */
  width?: number;
  /** SVG canvas height — defaults to 600 */
  height?: number;
}
