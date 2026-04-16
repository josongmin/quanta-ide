import type { FunctionHeader } from "@quanta/app-ide/entities/function";
import type { Layer } from "@quanta/app-ide/entities/symbol";

/** Rich analysis data extracted from SymbolFacts for canvas visualization. */
export interface NodeEnrichment {
  heat?: { level: "hot" | "warm" | "cold"; rate?: string };
  stability?: number;
  churn90d?: number;
  incidentMatch?: { id: string; similarity: number; reason: string };
  hotPath?: { label: string; rank: number; total: number };
  hasBehaviorChange?: boolean;
  callers?: number;
  callees?: number;
}

/** A function/method rendered as a positioned card. */
export interface CanvasNode {
  id: string;
  fn: FunctionHeader;
  enrichment?: NodeEnrichment;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A class that contains method nodes. */
export interface ClassGroup {
  id: string;
  fn: FunctionHeader;
  enrichment?: NodeEnrichment;
  methods: CanvasNode[];
  x: number;
  y: number;
  w: number;
  h: number;
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

/** The central file container that groups all internal functions. */
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

/** Directed relationship between any two nodes (internal or external). */
export interface CanvasEdge {
  id: string;
  from: string;
  to: string;
  kind: "call" | "taint" | "dep";
  severity?: 1 | 2 | 3;
  label?: string;
  /** For taint edges: intermediate steps in the flow */
  taintSteps?: { symbol: string; hop: string }[];
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

/** A node in a taint data-flow chain. */
export interface TaintChainNode {
  id: string;
  kind: "source" | "sink" | "bundle";
  symbol: string;
  detail?: string;
  file?: string;
  ownerFn?: string;
  bundledSymbols?: string[];
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A complete taint data-flow chain rendered as a horizontal track. */
export interface TaintChain {
  id: string;
  severity: 1 | 2 | 3;
  owasp?: string;
  nodes: TaintChainNode[];
  y: number;
}

/** Full positioned graph ready for rendering. */
export interface CanvasGraph {
  fileGroup: FileGroup;
  classGroups: ClassGroup[];
  nodes: CanvasNode[];
  externalNodes: ExternalNode[];
  externalFileGroups: ExternalFileGroup[];
  edges: CanvasEdge[];
  taintChains: TaintChain[];
  width: number;
  height: number;
}
