import type { Layer } from "@quanta/app-ide/entities/symbol";

/** The rendered source code pane in the center of the canvas. */
export interface CodePane {
  source: string;
  x: number;
  y: number;
  w: number;
  h: number;
  lineHeight: number;
}

/**
 * A marker on a specific line of the code pane.
 * Used for taint annotations, call-site indicators, and function entry points.
 */
export interface LineMarker {
  line: number;
  side: "left" | "right";
  kind: "taint-source" | "taint-sink" | "taint-through" | "call-out" | "fn-entry" | "dep-in";
  label?: string;
  /** ID of the connected external node (for edge drawing) */
  extNodeId?: string;
  severity?: 1 | 2 | 3;
}

/** External caller/callee rendered outside the file group. */
export interface ExternalNode {
  id: string;
  name: string;
  file?: string;
  layer?: Layer;
  side: "left" | "right";
  connectedTo: string[];
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The central file container wrapping the code pane. */
export interface FileGroup {
  name: string;
  riskScore: number;
  loc: number;
  owner: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Visual container grouping external nodes that belong to the same file. */
export interface ExternalFileGroup {
  id: string;
  fileName: string;
  side: "left" | "right";
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A connection between a code line and an external node. */
export interface CanvasEdge {
  id: string;
  /** line number in the code (1-based) */
  line: number;
  side: "left" | "right";
  extNodeId: string;
  kind: "call" | "taint" | "dep";
  severity?: 1 | 2 | 3;
}

/** Full positioned graph ready for rendering. */
export interface CanvasGraph {
  fileGroup: FileGroup;
  codePane: CodePane;
  lineMarkers: LineMarker[];
  externalNodes: ExternalNode[];
  externalFileGroups: ExternalFileGroup[];
  edges: CanvasEdge[];
  width: number;
  height: number;
}
