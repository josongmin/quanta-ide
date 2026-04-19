import type { FileBlame } from "./blame";
import type { FileEffects } from "./effects";
import type { FileLatency } from "./latency";
import type { ProofBundle } from "./evidence";
import type { GraphHistory } from "./history";
import type { TracePack } from "./traces";

// ── Glossary (Workspace* naming) ─────────────────────────────────────
// WorkspaceGraph   — the data (files, edges, comments, proofs, history, blame, effects, latency, traces).
//                    No coordinates. Worker-transferable.
// WorkspaceLayout  — coordinate bag computed from WorkspaceGraph: fileRects,
//                    edgeRoutes, cluster rects + metadata, metrics, sccs, etc.
// WorkspaceView    — single-tier renderable subset: the file-tier view
//                    produced by buildWorkspaceView. Kind "files".
// WorkspaceScene   — tagged-union of renderables: "files" | "clusters" |
//                    "superclusters". Consumed by the scene store.
// ─────────────────────────────────────────────────────────────────────

export type ArchLayer = "domain" | "adapter" | "infra" | "ui" | "util" | "unknown";

export interface Rect { x: number; y: number; w: number; h: number; }

export interface SignalSummary {
  taintCount: number;
  blastCritical: number;
  deadCount: number;
  archViolations: number;
  cpxMax: number;
}

export interface FunctionBlock {
  name: string;
  startLine: number;
  endLine: number;
  signalCount: number;
  complexity: number;
}

// No position — WorkspaceLayout owns coordinates
export interface FileNode {
  id: string;         // file path
  name: string;
  layer: ArchLayer;
  riskScore: number;
  loc: number;
  signals: SignalSummary;
  functions: FunctionBlock[];  // City LOD — populated by DataTier 1
  /** Identifies the source graph when multiple graphs are joined. Absent
   *  ⇒ the file belongs to the canonical single-graph ("default"). */
  graphId?: string;
}

// Semantic layer groups all edge kinds into 4 conceptual planes so UI gates
// (LOD policy, HUD toggles, severity filters) operate on a small axis
// rather than a ~15-way kind enum. The analyzer is responsible for setting
// `layer`; when an upstream source only has `kind`, use `deriveEdgeLayer`
// to backfill.
export type EdgeLayer = "structural" | "flow" | "safety" | "impact";

// Superset of analyzer outputs from engine-catalog:
//   structural: import, call, reference, cfg, inheritance, test-covers, clone
//   flow:       dataflow, effect, pdg, alias, feature-flag
//   safety:     taint-propagation, sanitizer, race, cycle, finding, contract,
//               dead-edge, runtime-divergence
//   impact:     blast, impact, diff, dependency, witness, cochange,
//               rename-pair, supply-chain
// New kinds can be added without breaking callers because renderers fall
// back to the layer's default style when a kind is unknown.
export type EdgeKind =
  | "import"
  | "call"
  | "reference"
  | "cfg"
  | "inheritance"
  | "test-covers"
  | "clone"
  | "dataflow"
  | "effect"
  | "pdg"
  | "alias"
  | "feature-flag"
  | "taint-propagation"
  | "sanitizer"
  | "race"
  | "cycle"
  | "finding"
  | "contract"
  | "dead-edge"
  | "runtime-divergence"
  | "blast"
  | "impact"
  | "diff"
  | "dependency"
  | "witness"
  | "cochange"
  | "rename-pair"
  | "supply-chain";

export type EdgeSeverity = "low" | "medium" | "high" | "critical";

export interface FileEdge {
  id: string;
  from: string;  // FileNode.id
  to: string;
  kind: EdgeKind;
  layer: EdgeLayer;
  weight: number;
  /** Analyzer confidence 0..1 — renderer scales width by this. */
  confidence?: number;
  /** Static-analysis severity — filters and colour intensity hinge on this. */
  severity?: EdgeSeverity;
  /** Pointer back to proof_bundle / evidence id in the analysis layer. */
  evidenceId?: string;
  /** When true, renderer may apply motion (dashed flow, pulse, etc.). */
  animated?: boolean;
  /**
   * Optional source-line anchor inside `from`. When present, street/ground
   * renderers attach the edge to a glow point on the card's right edge at
   * this line's Y position instead of the rect centre — CodeSee / Sourcetrail
   * do this for call/taint edges so readers see exactly which line originates
   * the relation.
   */
  fromLine?: number;
  /** Symbol at `fromLine`, shown in tooltips / evidence. */
  fromSymbol?: string;
  /** Target-line anchor inside `to`. Same semantics as `fromLine`. */
  toLine?: number;
  /** Symbol at `toLine`. */
  toSymbol?: string;
  /** Identifies the source graph when multiple graphs are joined. Absent
   *  ⇒ the edge belongs to the canonical single-graph ("default"). */
  graphId?: string;
  /** When true, source and target are from different graphs — treat as
   *  cross-service / cross-repo call. Derived at join time. */
  crossGraph?: boolean;
}

/**
 * Derive the layer for a kind. Kept as a pure function rather than a Map
 * so new kinds force a TypeScript exhaustiveness error at the callsite —
 * which is what we want when the analyzer grows a new edge type.
 */
export function deriveEdgeLayer(kind: EdgeKind): EdgeLayer {
  switch (kind) {
    case "import":
    case "call":
    case "reference":
    case "cfg":
    case "inheritance":
    case "test-covers":
    case "clone":
      return "structural";
    case "dataflow":
    case "effect":
    case "pdg":
    case "alias":
    case "feature-flag":
      return "flow";
    case "taint-propagation":
    case "sanitizer":
    case "race":
    case "cycle":
    case "finding":
    case "contract":
    case "dead-edge":
    case "runtime-divergence":
      return "safety";
    case "blast":
    case "impact":
    case "diff":
    case "dependency":
    case "witness":
    case "cochange":
    case "rename-pair":
    case "supply-chain":
      return "impact";
  }
}

export interface WorkspaceComment {
  id: string;
  fileId: string;
  line: number;
  author: string;
  body: string;
  resolved: boolean;
  createdAt: number;
}

// No position here — WorkspaceLayout is separate
export interface WorkspaceGraph {
  files: FileNode[];
  fileEdges: FileEdge[];
  comments: WorkspaceComment[];
  // Record (not Map) so the graph survives structured-clone to the worker
  // without a serialize/deserialize hop. Key is FileEdge.evidenceId.
  proofs?: Record<string, ProofBundle>;
  /** Commit-ordered edge snapshots. Consumed by the temporal slider / diff
   *  mode; absent ⇒ temporal UI unavailable. */
  history?: GraphHistory;
  /** Optional blame records, keyed by fileId. Survives structured-clone to worker. */
  blame?: Record<string, FileBlame>;
  /** Per-file side-effect annotations, keyed by fileId. */
  effects?: Record<string, FileEffects>;
  /** Per-file p50/p95/p99 latency readings, keyed by fileId. */
  latency?: Record<string, FileLatency>;
  /** Captured runtime traces. Absent ⇒ no trace overlay UI. */
  traces?: TracePack;
}
