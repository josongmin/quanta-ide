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
  /** Terminal endpoint (DB, cache, queue, etc.) */
  isTerminal?: boolean;
  terminalKind?: "db" | "cache" | "queue" | "api" | "storage";
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
  /** Peak cyclomatic complexity */
  cpxMax: number;
  /** Complexity budget usage (0–100+) */
  cpxBudgetPct: number;
  /** Blast radius — total affected nodes */
  blast: number;
  /** Critical blast targets */
  blastCritical: number;
  /** Number of taint flows */
  taintCount: number;
  /** Architecture layer violations */
  archViolations: number;
  /** Dead-code symbol count */
  deadCount: number;
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

/** Edge confidence level — how certain the analysis is about this connection. */
export type Confidence = "high" | "medium" | "low";

/** A connection between a specific symbol in the code and an external node. */
export interface CanvasEdge {
  id: string;
  /** line number in the code (1-based) */
  line: number;
  /** character offset of the symbol in the line (0-based) */
  col: number;
  /** length of the symbol text */
  symbolLen: number;
  side: "left" | "right";
  extNodeId: string;
  kind: "call" | "taint" | "dep";
  severity?: 1 | 2 | 3;
  /** descriptive label shown on the edge */
  label?: string;
  /** unique color for this symbol (hex) */
  color: string;
  /** analysis confidence for this edge */
  confidence?: Confidence;
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

// ── Interaction & flow types ──────────────────────────────────────

/** Active selection state — what the user is currently focusing on. */
export interface CanvasSelection {
  /** ID of the trigger element (node or edge that was clicked) */
  nodeId?: string;
  /** Edge IDs forming the active flow path */
  flowPath: string[];
  /** Node IDs in the active flow */
  flowNodes: string[];
  /** Lines in the code pane that are part of the active flow */
  activeLines: number[];
}

/** Filter criteria for edge visibility. */
export interface FlowFilter {
  /** Only include edges of these kinds */
  kinds?: CanvasEdge["kind"][];
  /** Only include edges at or above this confidence level */
  minConfidence?: Confidence;
}

/** A logical segment of a complex flow (for partitioned navigation). */
export interface FlowSegment {
  id: string;
  label: string;
  /** Edge IDs belonging to this segment */
  edgeIds: string[];
  /** Node IDs belonging to this segment */
  nodeIds: string[];
}
