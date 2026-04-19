import type {
  EdgeKind,
  EdgeSeverity,
  FileEdge,
  FileNode,
  WorkspaceComment,
  WorkspaceGraph,
} from "./types";
import { deriveEdgeLayer } from "./types";
import type { ProofBundle } from "./evidence";

export interface NamedGraph {
  graphId: string;
  label: string;
  color: number;
  graph: WorkspaceGraph;
}

export type JoinKind = "api-call" | "queue" | "shared-db" | "rpc";

export interface JoinEdge {
  fromGraphId: string;
  fromFileId: string;
  toGraphId: string;
  toFileId: string;
  kind: JoinKind;
  severity?: EdgeSeverity;
  weight?: number;
  confidence?: number;
  evidenceId?: string;
}

const JOIN_KIND_MAP: Record<JoinKind, EdgeKind> = {
  "api-call": "dependency",
  queue: "impact",
  "shared-db": "reference",
  rpc: "call",
};

export const JOIN_KIND_TO_EDGE_KIND: Readonly<Record<JoinKind, EdgeKind>> = JOIN_KIND_MAP;

function prefixId(graphId: string, id: string): string {
  return `${graphId}::${id}`;
}

function prefixFile(graphId: string, file: FileNode): FileNode {
  return {
    ...file,
    id: prefixId(graphId, file.id),
    graphId,
  };
}

function prefixEdge(graphId: string, edge: FileEdge): FileEdge {
  return {
    ...edge,
    id: prefixId(graphId, edge.id),
    from: prefixId(graphId, edge.from),
    to: prefixId(graphId, edge.to),
    graphId,
    crossGraph: false,
  };
}

function prefixComment(graphId: string, comment: WorkspaceComment): WorkspaceComment {
  return {
    ...comment,
    id: prefixId(graphId, comment.id),
    fileId: prefixId(graphId, comment.fileId),
  };
}

function prefixProofs(
  graphId: string,
  proofs: Record<string, ProofBundle> | undefined,
): Record<string, ProofBundle> {
  if (!proofs) return {};
  const out: Record<string, ProofBundle> = {};
  for (const [key, bundle] of Object.entries(proofs)) {
    const newId = prefixId(graphId, bundle.id);
    out[prefixId(graphId, key)] = {
      ...bundle,
      id: newId,
      steps: bundle.steps.map(step => ({
        ...step,
        stepId: prefixId(graphId, step.stepId),
        file: prefixId(graphId, step.file),
      })),
    };
  }
  return out;
}

function remapEvidenceIds(edges: FileEdge[], graphId: string): FileEdge[] {
  return edges.map(e =>
    e.evidenceId ? { ...e, evidenceId: prefixId(graphId, e.evidenceId) } : e,
  );
}

export function joinGraphs(
  graphs: readonly NamedGraph[],
  joinEdges: readonly JoinEdge[],
): WorkspaceGraph {
  const files: FileNode[] = [];
  const fileEdges: FileEdge[] = [];
  const comments: WorkspaceComment[] = [];
  const proofs: Record<string, ProofBundle> = {};

  const graphById = new Map<string, NamedGraph>();
  for (const g of graphs) graphById.set(g.graphId, g);

  for (const named of graphs) {
    const { graphId, graph } = named;
    for (const file of graph.files) files.push(prefixFile(graphId, file));
    const prefixed = graph.fileEdges.map(e => prefixEdge(graphId, e));
    for (const e of remapEvidenceIds(prefixed, graphId)) fileEdges.push(e);
    for (const c of graph.comments) comments.push(prefixComment(graphId, c));
    const pp = prefixProofs(graphId, graph.proofs);
    for (const [k, v] of Object.entries(pp)) proofs[k] = v;
  }

  for (let i = 0; i < joinEdges.length; i++) {
    const je = joinEdges[i];
    const fromFile = prefixId(je.fromGraphId, je.fromFileId);
    const toFile = prefixId(je.toGraphId, je.toFileId);
    const kind = JOIN_KIND_MAP[je.kind];
    const layer = deriveEdgeLayer(kind);
    const crossGraph = je.fromGraphId !== je.toGraphId;
    fileEdges.push({
      id: `join::${je.fromGraphId}:${je.fromFileId}->${je.toGraphId}:${je.toFileId}:${je.kind}:${i}`,
      from: fromFile,
      to: toFile,
      kind,
      layer,
      weight: je.weight ?? 1,
      severity: je.severity,
      confidence: je.confidence,
      evidenceId: je.evidenceId,
      graphId: je.fromGraphId,
      crossGraph,
    });
  }

  return { files, fileEdges, comments, proofs: Object.keys(proofs).length > 0 ? proofs : undefined };
}
