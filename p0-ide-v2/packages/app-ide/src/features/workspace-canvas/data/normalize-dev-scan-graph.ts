import type { FileEdge, FileNode, WorkspaceGraph } from "@quanta/canvas-engine";

/**
 * Post-processes dev-server `__repo/scan` output: sane edges + cheap
 * heuristics so Universe / Code City / dashboards get more signal without
 * a real analysis engine.
 */
export function normalizeWorkspaceGraphForDevScan(graph: WorkspaceGraph): WorkspaceGraph {
  const fileIds = new Set(graph.files.map(f => f.id));

  const edgeDedupKey = (e: FileEdge): string => `${e.from}\0${e.to}\0${e.kind}`;
  const seenKeys = new Set<string>();
  const rawEdges: FileEdge[] = [];
  for (const e of graph.fileEdges) {
    if (e.from === e.to) continue;
    if (!fileIds.has(e.from) || !fileIds.has(e.to)) continue;
    const k = edgeDedupKey(e);
    if (seenKeys.has(k)) continue;
    seenKeys.add(k);
    rawEdges.push(e);
  }

  const fileEdges: FileEdge[] = rawEdges.map((e, i) => ({
    ...e,
    id: `scan:e${i}`,
  }));

  const outDeg = new Map<string, number>();
  const inDeg = new Map<string, number>();
  for (const e of fileEdges) {
    outDeg.set(e.from, (outDeg.get(e.from) ?? 0) + 1);
    inDeg.set(e.to, (inDeg.get(e.to) ?? 0) + 1);
  }

  const files: FileNode[] = graph.files.map(f => {
    const fanOut = outDeg.get(f.id) ?? 0;
    const fanIn = inDeg.get(f.id) ?? 0;
    const fnCpx = f.functions.reduce((m, fn) => Math.max(m, fn.complexity ?? 0), 0);
    const cpxMax = Math.max(f.signals.cpxMax, fnCpx > 0 ? fnCpx : 1);

    const archBoost =
      fanOut > 28 ? 3 : fanOut > 18 ? 2 : fanOut > 10 ? 1 : 0;
    const archViolations = f.signals.archViolations + archBoost;

    // Isolated large files — weak “orphan” hint for UI metaphors.
    const deadBoost = fanIn === 0 && fanOut === 0 && f.loc > 400 ? 1 : 0;
    const deadCount = f.signals.deadCount + deadBoost;

    const baseRisk = f.riskScore > 1 ? f.riskScore / 100 : f.riskScore;
    const fanFactor = Math.min(0.1, fanOut * 0.003 + fanIn * 0.0015);
    const cpxFactor = Math.min(0.08, (cpxMax - 1) / 60);
    const locFactor = Math.min(0.06, f.loc / 6000);
    const riskScore = Math.min(0.96, baseRisk + fanFactor + cpxFactor * 0.45 + locFactor * 0.35);

    return {
      ...f,
      riskScore,
      signals: {
        ...f.signals,
        cpxMax,
        archViolations,
        deadCount,
      },
    };
  });

  return {
    ...graph,
    files,
    fileEdges,
  };
}
