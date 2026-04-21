// galaxy-3d types — pure data, no DOM

import type { WorkspaceGraph, SymbolNodeKind } from "@quanta/canvas-engine";

export type Galaxy3DNodeKind = "center" | "hub" | "file" | "symbol";

export interface Galaxy3DNode {
  /** Unique node id. For files: the file path. For symbols: the
   *  encoded `SymbolNode.id`. For hubs: `__hub__<kind>`. Used as the
   *  selection target AND the raycaster hit id — must be globally
   *  unique across the layout. */
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
  /** center / hub / file / symbol — default "file" for backwards compat. */
  kind?: Galaxy3DNodeKind;
  /** Symbol-only. The parent file this symbol was expanded out of.
   *  Used as the "whoosh" origin for the birth animation and for
   *  drawing the tree edge file → symbol. */
  parentFileId?: string;
  /** Symbol-only. Drives the glyph (ƒ / {} / ◇ / …) shown in the label. */
  symbolKind?: SymbolNodeKind;
}

export interface Galaxy3DEdge {
  from: string;
  to: string;
  highlighted: boolean;
  /** True for the structural file→symbol tether drawn under an expanded
   *  file. Renderer paints these thinner/dashed to distinguish from
   *  real call edges. */
  tree?: boolean;
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
  /** Files whose symbols should be spawned as child nodes in the scene.
   *  Managed by the view as transient UI state — not derived from the
   *  store. Absent / empty ⇒ pure file-tier view (current behavior). */
  expandedFileIds?: ReadonlySet<string>;
}
