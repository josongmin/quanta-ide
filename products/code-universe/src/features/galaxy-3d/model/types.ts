// galaxy-3d types — pure data, no DOM

import type { WorkspaceGraph } from "@quanta/canvas-engine";

export type Galaxy3DNodeKind = "center" | "hub" | "file";

export interface Galaxy3DNode {
  fileId: string;
  fileName: string;
  packageId: string;
  packageLabel: string;
  x: number; y: number; z: number;
  radius: number;
  colorHex: string;   // CSS hex e.g. "#22a06b"
  colorInt: number;   // 0xRRGGBB for Three.js
  riskScore: number;
  edgeCount: number;
  /** center / hub / file — default "file" for backwards compat. */
  kind?: Galaxy3DNodeKind;
}

export interface Galaxy3DEdge {
  from: string;
  to: string;
  highlighted: boolean;
}

export interface Galaxy3DLayout {
  nodes: Galaxy3DNode[];
  edges: Galaxy3DEdge[];
  /** dir → Three.js color int, for consistent package coloring */
  packageColorMap: Map<string, number>;
  center: string | null;
}

export interface BuildGalaxy3DLayoutOpts {
  graph: WorkspaceGraph;
  selectedId?: string;
}
