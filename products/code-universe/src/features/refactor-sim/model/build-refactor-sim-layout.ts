import {
  computeWorkspaceMetrics,
  computeRefactorROI,
  buildRefactorSuggestions,
  simulateRefactor,
  type RefactorPlanKind,
} from "@quanta/canvas-engine";
import type { BuildRefactorSimLayoutOpts, RefactorSimLayout, RefactorSimRow } from "./types";

const DEFAULT_MAX_PLANS = 15;

const KIND_COLORS: Record<RefactorPlanKind, string> = {
  "extract-interface": "#6366f1",
  "split-file": "#f97316",
  "break-cycle": "#ef4444",
  "invert-dependency": "#8b5cf6",
  "add-tests": "#22a06b",
  "reduce-fan-in": "#0d99ff",
};

function basenameOf(fileId: string): string {
  const idx = fileId.lastIndexOf("/");
  return idx >= 0 ? fileId.slice(idx + 1) : fileId;
}

const EMPTY_LAYOUT: RefactorSimLayout = {
  rows: [],
  bestMoveSummary: null,
  totalFiles: 0,
};

export function buildRefactorSimLayout(opts: BuildRefactorSimLayoutOpts): RefactorSimLayout {
  const { graph, maxPlans = DEFAULT_MAX_PLANS } = opts;

  if (graph.files.length === 0) {
    return EMPTY_LAYOUT;
  }

  // Step 1: workspace metrics
  let metrics;
  try {
    metrics = computeWorkspaceMetrics(graph);
  } catch {
    return EMPTY_LAYOUT;
  }
  if (metrics.fileCount === 0) return EMPTY_LAYOUT;

  // Step 2: refactor ROI
  let roi;
  try {
    roi = computeRefactorROI(graph, metrics);
  } catch {
    return EMPTY_LAYOUT;
  }

  // Step 3: build suggestions — flatten the per-file map into a flat list
  const suggestionsMap = buildRefactorSuggestions(roi);
  const allPlans = [];
  for (const plans of suggestionsMap.values()) {
    for (const plan of plans) {
      allPlans.push(plan);
    }
  }
  if (allPlans.length === 0) {
    return { rows: [], bestMoveSummary: null, totalFiles: graph.files.length };
  }

  // Step 4: simulate each plan and collect rows
  const rows: RefactorSimRow[] = [];
  for (const plan of allPlans.slice(0, maxPlans)) {
    let sim;
    try {
      sim = simulateRefactor(roi, plan);
    } catch {
      continue;
    }

    const delta = sim.after.total - sim.before.total;

    // Collect per-file deltas for hover expansion
    const affectedDetails: Array<{ fileId: string; delta: number }> = [];
    for (const [fid, d] of sim.terrainDelta) {
      affectedDetails.push({ fileId: fid, delta: d });
    }
    // Sort by abs delta descending for the expansion panel
    affectedDetails.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

    const currentScore = roi.scores.get(plan.fileId)?.score ?? 0;

    rows.push({
      rank: 0, // assigned after sort
      fileId: plan.fileId,
      fileName: basenameOf(plan.fileId),
      kind: plan.kind,
      score: currentScore,
      projectedDelta: delta,
      affectedCount: plan.affectedFileIds.length,
      confidence: plan.confidence,
      effort: plan.kind === "break-cycle" || plan.kind === "split-file" || plan.kind === "invert-dependency"
        ? "high"
        : plan.kind === "extract-interface" || plan.kind === "add-tests"
          ? "medium"
          : "low",
      barColor: KIND_COLORS[plan.kind],
      affectedDetails,
    });
  }

  if (rows.length === 0) {
    return { rows: [], bestMoveSummary: null, totalFiles: graph.files.length };
  }

  // Step 5: sort by absolute delta magnitude (biggest improvement first)
  rows.sort((a, b) => Math.abs(b.projectedDelta) - Math.abs(a.projectedDelta));
  for (let i = 0; i < rows.length; i++) rows[i].rank = i + 1;

  // Best-move summary
  const best = rows[0];
  const savings = Math.abs(best.projectedDelta).toFixed(1);
  const bestMoveSummary = `Best move: ${best.kind} ${best.fileName} → saves ${savings} total debt points`;

  return {
    rows,
    bestMoveSummary,
    totalFiles: graph.files.length,
  };
}
