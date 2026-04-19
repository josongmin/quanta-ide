import type { RefactorRoiResult, RefactorRoiScore } from "./refactor-roi";

// Rule-based refactor plan generator. Swappable with an LLM provider
// producing the same RefactorPlan shape.

export type RefactorPlanKind =
  | "extract-interface"
  | "split-file"
  | "break-cycle"
  | "invert-dependency"
  | "add-tests"
  | "reduce-fan-in";

export interface RefactorPlan {
  id: string;
  kind: RefactorPlanKind;
  fileId: string;
  title: string;
  rationale: string;
  projectedRoiDelta: number;
  affectedFileIds: readonly string[];
  confidence: number;
}

export interface BuildSuggestionsOptions {
  maxPerFile?: number;
  sccs?: readonly (readonly string[])[];
}

const DEFAULT_MAX_PER_FILE = 2;
const TOP_FILES_CONSIDERED = 20;

const CONFIDENCE: Readonly<Record<RefactorPlanKind, number>> = {
  "break-cycle": 0.9,
  "split-file": 0.8,
  "add-tests": 0.8,
  "extract-interface": 0.7,
  "reduce-fan-in": 0.7,
  "invert-dependency": 0.6,
};

function shortName(id: string): string {
  const parts = id.split("/");
  return parts[parts.length - 1] ?? id;
}

function findSccPeers(
  sccs: readonly (readonly string[])[] | undefined,
  fileId: string,
): readonly string[] {
  if (!sccs) return [];
  for (const comp of sccs) {
    if (comp.length <= 1) continue;
    if (comp.includes(fileId)) return comp.filter(id => id !== fileId);
  }
  return [];
}

function buildPlan(
  kind: RefactorPlanKind,
  score: RefactorRoiScore,
  title: string,
  rationale: string,
  affectedFileIds: readonly string[],
): RefactorPlan {
  return {
    id: `${kind}:${score.fileId}`,
    kind,
    fileId: score.fileId,
    title,
    rationale,
    projectedRoiDelta: -0.3 * score.score,
    affectedFileIds,
    confidence: CONFIDENCE[kind],
  };
}

export function buildRefactorSuggestions(
  roi: RefactorRoiResult,
  options: BuildSuggestionsOptions = {},
): ReadonlyMap<string, readonly RefactorPlan[]> {
  const maxPerFile = Math.max(0, options.maxPerFile ?? DEFAULT_MAX_PER_FILE);
  const out = new Map<string, readonly RefactorPlan[]>();
  if (maxPerFile === 0) return out;

  const top = roi.ordered.slice(0, TOP_FILES_CONSIDERED);
  for (const score of top) {
    const plans: RefactorPlan[] = [];
    const c = score.components;
    const file = shortName(score.fileId);

    const pushIf = (cond: boolean, make: () => RefactorPlan): void => {
      if (plans.length >= maxPerFile) return;
      if (!cond) return;
      plans.push(make());
    };

    // Rules ordered by specificity — targeted first so maxPerFile cap
    // prefers actionable plans over generic ones.
    pushIf(c.cycleMembership > 50 && !!options.sccs, () => {
      const peers = findSccPeers(options.sccs, score.fileId);
      return buildPlan(
        "break-cycle",
        score,
        `Break cycle involving ${file}`,
        `This file sits in a strongly-connected component with ${peers.length} peer(s); breaking the cycle lets callers depend on a stable subset.`,
        peers,
      );
    });

    pushIf(c.fanIn > 60 && c.complexity > 40, () =>
      buildPlan(
        "extract-interface",
        score,
        `Extract an interface for ${file}`,
        `High fan-in meets non-trivial complexity: introducing an interface isolates callers from internal churn.`,
        [],
      ),
    );

    pushIf(c.complexity > 70, () =>
      buildPlan(
        "split-file",
        score,
        `Split ${file} into cohesive modules`,
        `Complexity is well above threshold; splitting reduces cognitive load and blast radius per change.`,
        [],
      ),
    );

    pushIf(c.testDebt > 50, () =>
      buildPlan(
        "add-tests",
        score,
        `Add tests for ${file}`,
        `Untested taint and blast-critical signals concentrate risk here; regression coverage pays back on every future change.`,
        [],
      ),
    );

    pushIf(c.fanIn > 80, () =>
      buildPlan(
        "reduce-fan-in",
        score,
        `Reduce fan-in into ${file}`,
        `Outlier incoming coupling forces every caller to adopt this file's shape; narrowing the public surface decouples them.`,
        [],
      ),
    );

    if (plans.length > 0) out.set(score.fileId, plans);
  }

  return out;
}
