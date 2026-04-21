// Author Territory — type contracts
// --------------------------------------------------------------------
// Maps each file to its dominant author (by most recent blame entry)
// and groups files into "territories" in a treemap layout. The view
// renders each author as a large colored region with per-file nested
// rects, coloured by a blend of author hue and file age.

import type { ArchLayer, WorkspaceGraph } from "@quanta/canvas-engine";

/** One file inside an author's territory. */
export interface AuthorFile {
  /** File id from WorkspaceGraph.files */
  fileId: string;
  fileName: string;
  layer: ArchLayer;
  loc: number;
  riskScore: number;
  author: string;
  /** ms since epoch of the most recent blame entry for this file */
  lastEditedAt: number;
  /** Age in ms at layout-build time: now - lastEditedAt */
  ageMs: number;
  /** SVG position and size (within parent territory rect) */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Final blended fill colour for the rectangle */
  color: string;
}

/** One author's grouped territory. */
export interface AuthorGroup {
  author: string;
  files: AuthorFile[];
  totalLoc: number;
  avgRisk: number;
  /** Base hue colour derived from author name (HSL hash) */
  color: string;
  /** Outer territory bounding rect in SVG space */
  territory: { x: number; y: number; w: number; h: number };
}

export interface AuthorTerritoryLayout {
  groups: AuthorGroup[];
  allFiles: AuthorFile[];
  hasBlame: true;
}

export interface AuthorTerritoryLayoutEmpty {
  hasBlame: false;
}

export type AuthorTerritoryResult = AuthorTerritoryLayout | AuthorTerritoryLayoutEmpty;

export interface BuildAuthorTerritoryLayoutOpts {
  graph: WorkspaceGraph;
  /** SVG canvas width */
  width: number;
  /** SVG canvas height */
  height: number;
  /** Override current time for deterministic tests */
  now?: number;
}
