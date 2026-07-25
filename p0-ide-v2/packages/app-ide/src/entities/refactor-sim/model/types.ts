/**
 * Refactor Safety Simulator — entity model.
 *
 * Describes a pre-application simulation of a candidate refactor, including
 * the before/after call/import flow graphs, impact deltas across blast
 * radius, consumers, tests, ownership, and a list of verifier claims that
 * compose a 0-100 safety score.
 */

export type RefactorOp =
  | "extract-method"
  | "split-file"
  | "inline"
  | "rename"
  | "move"
  | "extract-interface";

export interface FlowNode {
  id: string;
  label: string;
  kind: "fn" | "class" | "module" | "external";
}

export interface FlowEdge {
  from: string;
  to: string;
  kind: "call" | "import" | "mutate";
}

export interface FlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export type EdgeDelta =
  | { op: "add"; edge: FlowEdge }
  | { op: "remove"; edge: FlowEdge };

export interface OwnershipShiftEntry {
  owner: string;
  pctBefore: number;
  pctAfter: number;
}

export interface ImpactDelta {
  blastBefore: number;
  blastAfter: number;
  consumersAffected: number;
  testsStale: number;
  testsStillCover: number;
  coverageGapLines: number;
  ownershipShift: OwnershipShiftEntry[];
}

export interface SafetyClaim {
  id: string;
  label: string;
  status: "pass" | "fail" | "warn";
  evidence: string;
  verifier: string;
}

export interface RefactorCandidate {
  id: string;
  title: string;
  op: RefactorOp;
  description: string;
  before: FlowGraph;
  after: FlowGraph;
  edgeDeltas: EdgeDelta[];
  impact: ImpactDelta;
  claims: SafetyClaim[];
  safetyScore: number;
}

export interface RefactorSim {
  candidates: RefactorCandidate[];
}

/**
 * Lookup helper. Mock implementation lives in `../api/mock.ts`; the entity
 * index.ts re-exports that concrete binding. Declared here so downstream
 * features can import the signature from the types module too.
 */
export type GetRefactorSim = (fileName: string) => RefactorSim | null;
