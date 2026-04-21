// Arc Diagram types — Cycle Detection view
// --------------------------------------------------------------------
// Files (or packages) arranged horizontally in topological order.
// Import arcs bow ABOVE the baseline (blue); backward edges that
// create cycles bow BELOW the line (red).  This makes import cycles
// immediately legible at a glance — a cluster of red arcs under the
// baseline is a cycle.
//
// Separation of concerns: `buildArcLayout` produces this pure-data
// layout; `ArcView` renders it.  No tree/graph traversal in React.

import type { EntityKind } from "@quanta/canvas-engine";

/** One node on the horizontal axis. */
export interface ArcNode {
  id: string;
  label: string;
  kind: EntityKind;
  /** 0-based position in the linear ordering */
  index: number;
  /** x coordinate in SVG (computed from index) */
  x: number;
  color: string;
  /** true = this node is part of at least one SCC (cycle) */
  inCycle: boolean;
  /** which SCC index this node belongs to (undefined if trivial) */
  sccIndex?: number;
  /** Sublabel — e.g. "12 files" or "248 LoC" */
  sublabel: string;
}

/** A directed arc between two nodes. */
export interface ArcEdge {
  id: string;
  fromId: string;
  toId: string;
  /** true = this edge goes BACKWARD in topo order — it's a cycle edge */
  isBackward: boolean;
  weight: number;
  /** Height of the arc peak in SVG units — proportional to span */
  height: number;
}

export interface ArcLayout {
  nodes: ArcNode[];
  edges: ArcEdge[];
  /** Total number of SCCs found (non-trivial, i.e. actual cycles) */
  sccCount: number;
  /** Total backward edge count = cycle edges */
  cycleEdgeCount: number;
  /** nodeSpacing in SVG units */
  nodeSpacing: number;
  /** entities dropped because of maxNodes cap */
  overflow: number;
}

export interface BuildArcLayoutOpts {
  tree: import("@quanta/canvas-engine").EntityTree;
  graph: import("@quanta/canvas-engine").WorkspaceGraph;
  width: number;
  height: number;
  /** Kind to use as nodes — defaults to "galaxy" (inter-package cycles) */
  nodeKind?: "galaxy" | "building";
  /** Scope to a subtree — null = workspace root */
  scopeId?: string | null;
  /** Max nodes before trimming — defaults to 60 */
  maxNodes?: number;
}
