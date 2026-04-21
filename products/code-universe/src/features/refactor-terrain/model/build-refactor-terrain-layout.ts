import {
  computeWorkspaceMetrics,
  findStronglyConnectedComponents,
  computeRefactorROI,
  buildRefactorSuggestions,
  type RefactorPlanKind,
} from "@quanta/canvas-engine";
import type { BuildRefactorTerrainLayoutOpts, RefactorTerrainLayout, RefactorTerrainRow } from "./types";

const DEFAULT_MAX_ROWS = 30;

const COMPONENT_COLORS: RefactorTerrainLayout["componentColors"] = {
  churn: "#f97316",
  complexity: "#ef4444",
  fanIn: "#6366f1",
  testDebt: "#eab308",
  cycleMembership: "#8b5cf6",
};

function deriveEffort(kind: RefactorPlanKind): "low" | "medium" | "high" {
  switch (kind) {
    case "break-cycle":
    case "split-file":
    case "invert-dependency":
      return "high";
    case "extract-interface":
    case "add-tests":
      return "medium";
    case "reduce-fan-in":
      return "low";
  }
}

function scoreToBarColor(score: number): string {
  const hue = 120 - score * 1.2;
  return `hsl(${hue}deg, 65%, 50%)`;
}

function basenameOf(fileId: string): string {
  const idx = fileId.lastIndexOf("/");
  return idx >= 0 ? fileId.slice(idx + 1) : fileId;
}

function dirOf(fileId: string): string {
  const idx = fileId.lastIndexOf("/");
  if (idx <= 0) return fileId;
  // Take the last segment of the directory portion.
  const dir = fileId.slice(0, idx);
  const dirIdx = dir.lastIndexOf("/");
  return dirIdx >= 0 ? dir.slice(dirIdx + 1) : dir;
}

export function buildRefactorTerrainLayout(
  opts: BuildRefactorTerrainLayoutOpts,
): RefactorTerrainLayout {
  const { tree, graph, maxRows = DEFAULT_MAX_ROWS } = opts;

  if (graph.files.length === 0) {
    return {
      rows: [],
      totalFiles: 0,
      overflow: 0,
      maxScore: 0,
      componentColors: COMPONENT_COLORS,
    };
  }

  // Step 1: compute workspace metrics (degree centrality, etc.)
  const metrics = computeWorkspaceMetrics(graph);

  // Step 2: find SCCs for cycle membership scoring
  const sccResult = findStronglyConnectedComponents(graph);

  // Step 3: compute refactor ROI scores
  const roi = computeRefactorROI(graph, metrics, { sccs: sccResult.components });

  // Step 4: build refactor suggestions (title used as suggestion text)
  const suggestionsMap = buildRefactorSuggestions(roi, { sccs: sccResult.components });

  // Step 5: map roi.ordered → RefactorTerrainRow
  const totalFiles = roi.ordered.length;
  const sliced = roi.ordered.slice(0, maxRows);

  const rows: RefactorTerrainRow[] = sliced.map((score) => {
    const label = basenameOf(score.fileId);

    // Walk ancestors to find a galaxy-level name.
    let groupLabel = dirOf(score.fileId);
    if (tree) {
      const ancestors = tree.ancestorsOf(score.fileId);
      // ancestorsOf includes the node itself; walk to find galaxy ancestor.
      for (const anc of ancestors) {
        if (anc.kind === "galaxy") {
          groupLabel = anc.name;
          break;
        }
        if (anc.kind === "street") {
          groupLabel = anc.name;
          // Keep looking for galaxy.
        }
      }
    }

    const barColor = scoreToBarColor(score.score);

    const plans = suggestionsMap.get(score.fileId);
    const topPlan = plans?.[0];

    const suggestion = topPlan ? topPlan.title : undefined;
    const effort = topPlan ? deriveEffort(topPlan.kind) : undefined;

    return {
      fileId: score.fileId,
      label,
      groupLabel,
      rank: score.rank,
      score: score.score,
      components: {
        churn: score.components.churn,
        complexity: score.components.complexity,
        fanIn: score.components.fanIn,
        testDebt: score.components.testDebt,
        cycleMembership: score.components.cycleMembership,
      },
      barColor,
      suggestion,
      effort,
    };
  });

  const overflow = Math.max(0, totalFiles - maxRows);

  return {
    rows,
    totalFiles,
    overflow,
    maxScore: roi.maxScore,
    componentColors: COMPONENT_COLORS,
  };
}
