// Chord + Hierarchical Edge Bundling types
// --------------------------------------------------------------------
// A third Code Universe visualisation mode (alongside treemap and
// mind-map). Files sit on a ring; groups (packages / dirs) are arcs on
// that ring; dependency edges route through the hierarchy's LCA and are
// bundled into trunks (Holten 2006). The purpose of the layout is to
// let the user see package-to-package coupling at a glance without the
// spatial clutter of the treemap.
//
// Pure-data-in / pure-data-out: `buildChordLayout` returns a ChordLayout
// and the SVG renderer paints from that. No tree/graph traversal
// happens in React, and determinism is testable without rendering.
//
// Extension point — concentric rings: today only depth=0 groups (one
// ring) are emitted. Nested groups (package arc wraps dir arcs) would
// be depth=1+; the type contract already carries `depth` so renderers
// can accommodate them without a schema change.

import type { EntityKind, EntityTree, WorkspaceGraph } from "@quanta/canvas-engine";

/** One group (package/directory) rendered as an arc on the ring. */
export interface ChordGroup {
  id: string;         // entity id (galaxy or street)
  label: string;
  kind: EntityKind;   // usually "galaxy" or "street"
  startAngle: number; // radians, 0 = east, CCW positive — inclusive
  endAngle: number;   // exclusive
  /** Depth in the hierarchy; 0 = outermost group. Nested groups use
   *  this for concentric arc rings (e.g. package arc wraps dir arcs). */
  depth: number;
  color: string;      // CSS hex for the arc fill
  /** Leaf ids under this group, in angular order — lets consumers
   *  highlight all leaves under a group on hover without re-walking
   *  the tree. */
  leafIds: readonly string[];
}

/** One file sitting on the circumference. */
export interface ChordLeaf {
  id: string;          // entity id (file / building kind)
  label: string;       // short name
  groupId: string;     // parent arc's id
  angle: number;       // radians, position on the circle
  x: number;           // cartesian (origin-centred)
  y: number;
  /** Tree path from the root down to this leaf, as a sequence of
   *  `{ x, y }` control points in the SVG's cartesian space. The
   *  edge-bundling path generator uses this to route a curve through
   *  the hierarchy's LCA. Indexed from root (index 0) to leaf
   *  (last index). */
  pathFromRoot: readonly { x: number; y: number }[];
}

export interface ChordEdge {
  id: string;
  fromId: string;
  toId: string;
  /** Semantic category — drives colour. Start with "import" only;
   *  future analyses (call, data-flow, control-flow, taint) plug in
   *  as additional categories without changing the layout algorithm. */
  category: "import" | "call" | "data-flow" | "control-flow" | "taint";
  weight: number; // edge count / strength
}

export interface ChordLayout {
  groups: readonly ChordGroup[];
  leaves: readonly ChordLeaf[];
  edges: readonly ChordEdge[];
  /** Inner radius of the leaf ring (px). The layout places labels at
   *  `outerRadius = innerRadius + LEAF_LABEL_BAND`. */
  innerRadius: number;
  /** Viewport-centred bounding box. */
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

export interface BuildChordLayoutOpts {
  tree: EntityTree;
  graph: WorkspaceGraph;
  /** Viewport size — innerRadius is derived from the short dim. */
  width: number;
  height: number;
  /** What level becomes a leaf on the ring.
   *  - `"galaxy"` (default) → each package is its own leaf. File edges
   *    roll up to galaxy-to-galaxy ribbons. This is the **package
   *    coupling view** — 10–30 nodes, readable at workspace scale.
   *  - `"building"` → each file is a leaf. Use ONLY with a tight
   *    `scopeId` (e.g. a single package), otherwise 1000+ file leaves
   *    make the ring unreadable. */
  leafKind?: "galaxy" | "building";
  /** Which hierarchy level becomes the arc groups (applies only when
   *  `leafKind === "building"`). `"galaxy"` → one arc per package;
   *  `"street"` → one per directory. Ignored in galaxy leaf mode
   *  because each galaxy IS its own arc. */
  groupBy?: "galaxy" | "street";
  /** Restrict to a subtree. If set, only leaves under `scopeId`
   *  participate and edges are filtered to those whose endpoints roll
   *  up into the scoped leaves. Matches the user's mental model of
   *  "focus on this package's chord" when diving in. */
  scopeId?: string | null;
}
