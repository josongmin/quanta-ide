// Matrix (DSM) view — type contract
// --------------------------------------------------------------------
// A fourth Code Universe visualisation mode (alongside treemap, mind-
// map, and chord). Entities sit on BOTH rows and columns in the same
// order. A cell `(row=i, col=j)` is filled when there's an import edge
// from entity i → j. A clustering pass reorders rows/cols so dense
// blocks form along the diagonal — natural communities become visually
// obvious, isolated utilities fall out to the edges, and cyclic
// coupling jumps out as off-diagonal mirror pairs.
//
// Why DSM complements chord: chord renders inter-package edges as
// curves across a ring, which is great for "what calls what across
// packages". DSM collapses that same information to cell colour,
// which is great for "which subsystems hang together" at a glance.
// The two views answer different shapes of question — hence the
// segmented picker in the toolbar lets users toggle between them.
//
// Pure-data-in / pure-data-out: `buildMatrixLayout` returns a
// MatrixLayout and the SVG renderer paints from that. No tree/graph
// traversal happens in React, and determinism is testable without
// rendering.

import type { EntityKind, EntityTree, WorkspaceGraph } from "@quanta/canvas-engine";

export interface MatrixRow {
  /** Entity id (file-level usually). */
  id: string;
  /** Short name for axis label. */
  label: string;
  /** Package / dir id the row belongs to — drives group colouring and
   *  the boundary lines that punctuate the grid. */
  groupId: string;
  /** Package / dir display name — shown in tooltips and legends. */
  groupLabel: string;
  /** CSS hex — same colour for all rows in a group. Id-hashed HSL so
   *  distinct packages stand apart visually. */
  groupColor: string;
  kind: EntityKind;
  /** Final row order index after clustering. 0 = topmost row. */
  index: number;
}

export interface MatrixCell {
  /** Unique per cell: `${fromId}→${toId}`. */
  id: string;
  fromId: string;
  toId: string;
  /** Row / col indices AFTER clustering — feed directly into
   *  `index * cellSize` for painting. */
  row: number;
  col: number;
  /** Edge weight (call count / import multiplicity). 1 for a single
   *  import. Modulates cell opacity — strong edges pop darker. */
  weight: number;
  /** Whether this is a cross-group cell (from.group !== to.group).
   *  Drawn a touch darker / sharper so inter-package coupling pops
   *  over intra-package density. */
  crossGroup: boolean;
  /** Symmetric pair: true if `(toId → fromId)` also exists. Cycles
   *  are newsworthy — the renderer overlays a tiny glyph so they
   *  never hide inside the grid. */
  bidirectional: boolean;
}

export interface MatrixLayout {
  /** Ordering matches cols — the matrix is square, rows and cols
   *  share the same sequence. */
  rows: readonly MatrixRow[];
  /** Sparse — only filled cells. A 200×200 matrix = 40k potential
   *  cells but typically <2000 filled. */
  cells: readonly MatrixCell[];
  /** Cell pixel size. Derived from viewport size so the grid fits. */
  cellSize: number;
  /** Label gutter (px) left of the matrix for row labels + top for
   *  col labels. The matrix origin sits at `(labelGutter,
   *  labelGutter)` in SVG coordinates. */
  labelGutter: number;
  /** Tight bounding box INCLUDING the label gutters. Lets the
   *  renderer size the SVG viewBox without a second pass. */
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  /** Group boundaries — indices where a new group starts. Renderers
   *  draw a dividing line at `index * cellSize` between different
   *  packages so the block structure pops. Always starts at 0 (the
   *  first group) and excludes `rows.length` (no line at the far
   *  edge). */
  groupBoundaries: readonly number[];
}

export interface BuildMatrixLayoutOpts {
  tree: EntityTree;
  graph: WorkspaceGraph;
  width: number;
  height: number;
  /** Which entity kind becomes the rows. Default `"building"` (files).
   *  `"galaxy"` collapses to a package-level DSM (way coarser, faster
   *  to scan on large workspaces). `"street"` sits between. */
  rowKind?: "building" | "street" | "galaxy";
  /** Max rows to render. If the workspace has more entities at
   *  `rowKind`, the layout keeps the TOP-N by fan-in + fan-out
   *  (most-connected survive) and emits `overflow` count for the UI.
   *  Default 200. */
  maxRows?: number;
  /** Scope — if set, only rows whose id falls under `scopeId`
   *  participate. Matches other views' "focus on this subtree". */
  scopeId?: string | null;
}

/** Return shape of `buildMatrixLayout` — MatrixLayout plus an overflow
 *  count for rows dropped due to `maxRows`. Renderers surface the
 *  overflow as a "+N more entities trimmed by connectivity rank"
 *  caption. Declared here so the public contract lives in `types.ts`;
 *  the implementation is in `./build-matrix-layout.ts`. */
export type MatrixLayoutResult = MatrixLayout & { overflow: number };
