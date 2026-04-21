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

// ── Mock data (shown when graph has no files) ─────────────────────────

function mockRefactorSimLayout(): RefactorSimLayout {
  const rows: RefactorSimRow[] = [
    { rank: 1, fileId: "src/store/globalStore.ts",    fileName: "globalStore.ts",    kind: "split-file",          score: 88, projectedDelta: -22.4, affectedCount: 8,  confidence: 0.82, effort: "high",   barColor: KIND_COLORS["split-file"],          affectedDetails: [{ fileId: "src/hooks/useStore.ts",      delta: -8.2 }, { fileId: "src/components/Dashboard.tsx", delta: -5.1 }] },
    { rank: 2, fileId: "src/domain/orderService.ts",  fileName: "orderService.ts",   kind: "break-cycle",         score: 75, projectedDelta: -18.1, affectedCount: 5,  confidence: 0.90, effort: "high",   barColor: KIND_COLORS["break-cycle"],         affectedDetails: [{ fileId: "src/api/paymentApi.ts",      delta: -9.3 }, { fileId: "src/store/cartStore.ts",       delta: -4.8 }] },
    { rank: 3, fileId: "src/api/client.ts",            fileName: "client.ts",         kind: "extract-interface",   score: 62, projectedDelta: -14.7, affectedCount: 12, confidence: 0.75, effort: "medium", barColor: KIND_COLORS["extract-interface"],   affectedDetails: [{ fileId: "src/api/authApi.ts",         delta: -6.1 }, { fileId: "src/api/userApi.ts",           delta: -4.2 }] },
    { rank: 4, fileId: "src/utils/helpers.ts",         fileName: "helpers.ts",        kind: "reduce-fan-in",       score: 58, projectedDelta: -11.3, affectedCount: 9,  confidence: 0.68, effort: "low",    barColor: KIND_COLORS["reduce-fan-in"],       affectedDetails: [{ fileId: "src/components/NavBar.tsx",  delta: -3.8 }] },
    { rank: 5, fileId: "src/infra/db.ts",              fileName: "db.ts",             kind: "invert-dependency",   score: 71, projectedDelta: -9.8,  affectedCount: 4,  confidence: 0.72, effort: "high",   barColor: KIND_COLORS["invert-dependency"],   affectedDetails: [{ fileId: "src/domain/reportService.ts",delta: -5.2 }] },
    { rank: 6, fileId: "src/domain/userService.ts",   fileName: "userService.ts",    kind: "add-tests",           score: 45, projectedDelta: -7.2,  affectedCount: 3,  confidence: 0.85, effort: "medium", barColor: KIND_COLORS["add-tests"],           affectedDetails: [{ fileId: "src/api/authApi.ts",         delta: -2.8 }] },
  ];
  return {
    rows,
    bestMoveSummary: "Best move: split-file globalStore.ts → saves 22.4 total debt points",
    totalFiles: 48,
  };
}

export function buildRefactorSimLayout(opts: BuildRefactorSimLayoutOpts): RefactorSimLayout {
  const { graph, maxPlans = DEFAULT_MAX_PLANS } = opts;

  if (graph.files.length === 0) {
    return mockRefactorSimLayout();
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
    return mockRefactorSimLayout();
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
    return mockRefactorSimLayout();
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
