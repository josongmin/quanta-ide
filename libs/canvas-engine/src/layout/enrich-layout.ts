import type { WorkspaceGraph } from "../graph/types";
import type { WorkspaceMetrics } from "../graph/metrics";
import type { StartHereEntry } from "../graph/start-here";
import { computeWorkspaceMetrics } from "../graph/metrics";
import { findStronglyConnectedComponents } from "../graph/scc";
import { rankStartHere } from "../graph/start-here";
import { detectArchViolations } from "../graph/arch-violations";

export interface EnrichOptions {
  computeMetrics?: boolean;
  betweennessExactThreshold?: number;
  computeSccs?: boolean;
  computeStartHere?: boolean;
  computeArchViolations?: boolean;
}

export interface EnrichResult {
  metrics?: WorkspaceMetrics;
  sccs?: readonly (readonly string[])[];
  startHere?: readonly StartHereEntry[];
  archViolations?: {
    edgeIds: readonly string[];
    byPair: Readonly<Record<string, number>>;
  };
}

export function enrichLayout(
  graph: Pick<WorkspaceGraph, "files" | "fileEdges">,
  opts: EnrichOptions = {},
): EnrichResult {
  const wantMetrics = opts.computeMetrics ?? true;
  const wantSccs = opts.computeSccs ?? true;
  const wantStartHere = opts.computeStartHere ?? true;
  const wantArch = opts.computeArchViolations ?? true;

  const metrics = wantMetrics
    ? computeWorkspaceMetrics(graph as WorkspaceGraph, {
        computeBetweenness: true,
        exactBetweennessThreshold: opts.betweennessExactThreshold,
      })
    : undefined;

  const sccs = wantSccs
    ? findStronglyConnectedComponents(graph as WorkspaceGraph).components
    : undefined;

  const startHere = wantStartHere && metrics
    ? rankStartHere(graph as WorkspaceGraph, metrics)
    : undefined;

  let archViolations: EnrichResult["archViolations"];
  if (wantArch) {
    const archRes = detectArchViolations(graph);
    if (archRes.violatingEdgeIds.size > 0) {
      archViolations = {
        edgeIds: Array.from(archRes.violatingEdgeIds),
        byPair: Object.fromEntries(archRes.byPair),
      };
    }
  }

  return { metrics, sccs, startHere, archViolations };
}
