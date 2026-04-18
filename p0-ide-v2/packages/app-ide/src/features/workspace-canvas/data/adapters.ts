import type { FileFacts } from "@quanta/app-ide/entities/file";
import type { WorkspaceGraph, FileNode, FileEdge } from "@quanta/canvas-engine";

export function fileFactsToWorkspaceGraph(files: FileFacts[]): WorkspaceGraph {
  const nodes: FileNode[] = files.map(f => ({
    id: f.name,
    name: f.name.split("/").at(-1) ?? f.name,
    layer: "unknown" as const,
    riskScore: f.riskScore,
    loc: f.loc,
    signals: {
      taintCount: f.taintCount,
      blastCritical: f.blastCritical,
      deadCount: f.deadCount,
      archViolations: f.archViolations,
      cpxMax: f.cpxMax,
    },
    functions: f.functionHeaders.map(fh => ({
      name: fh.name,
      startLine: fh.line,
      endLine: fh.line,
      signalCount: 0,
      complexity: fh.complexity,
    })),
  }));

  // Build edges from imports
  const edges: FileEdge[] = [];
  // No import graph available from FileFacts directly — return empty for now
  // Real implementation will come from workspace-level data

  return { files: nodes, fileEdges: edges, comments: [] };
}
