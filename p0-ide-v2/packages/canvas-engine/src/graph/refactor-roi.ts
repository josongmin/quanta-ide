import type { WorkspaceGraph } from "./types";
import type { WorkspaceMetrics } from "./metrics";

// Refactor ROI composites five independently-normalized 0..100 axes into a
// single "pain-removed-if-fixed" score. Kept pure so the Action Terrain
// overlay can re-score in a worker between interactions.

export interface RefactorRoiComponents {
  churn: number;
  complexity: number;
  fanIn: number;
  testDebt: number;
  cycleMembership: number;
}

export interface RefactorRoiWeights {
  churn: number;
  complexity: number;
  fanIn: number;
  testDebt: number;
  cycleMembership: number;
}

export interface RefactorRoiScore {
  fileId: string;
  score: number;
  components: RefactorRoiComponents;
  rank: number;
}

export interface RefactorRoiResult {
  scores: ReadonlyMap<string, RefactorRoiScore>;
  ordered: readonly RefactorRoiScore[];
  maxScore: number;
}

export interface ComputeRefactorRoiOptions {
  weights?: Partial<RefactorRoiWeights>;
  sccs?: readonly (readonly string[])[];
  now?: number;
}

export const DEFAULT_ROI_WEIGHTS: Readonly<RefactorRoiWeights> = Object.freeze({
  churn: 0.25,
  complexity: 0.20,
  fanIn: 0.20,
  testDebt: 0.20,
  cycleMembership: 0.15,
});

const NINETY_DAYS_MS = 90 * 86_400_000;

function clamp01to100(x: number): number {
  if (!Number.isFinite(x) || x <= 0) return 0;
  if (x >= 100) return 100;
  return x;
}

function normalizeToMax(raw: number, max: number): number {
  if (max <= 0) return 0;
  return clamp01to100((raw / max) * 100);
}

export function computeRefactorROI(
  graph: Pick<WorkspaceGraph, "files" | "fileEdges" | "blame">,
  metrics: WorkspaceMetrics,
  options: ComputeRefactorRoiOptions = {},
): RefactorRoiResult {
  const weights: RefactorRoiWeights = {
    ...DEFAULT_ROI_WEIGHTS,
    ...(options.weights ?? {}),
  };
  const now = options.now ?? Date.now();

  // SCC lookup — map fileId to its SCC size. Size 1 means trivial/no cycle.
  const sccSizeByFile = new Map<string, number>();
  if (options.sccs) {
    for (const comp of options.sccs) {
      if (comp.length <= 1) continue;
      for (const id of comp) sccSizeByFile.set(id, comp.length);
    }
  }

  // Raw passes — compute pre-normalization values per file, then find the
  // per-axis maxima for normalization. Two-pass keeps normalization stable.
  interface Raw {
    fileId: string;
    churnRaw: number;       // fraction 0..1 of lines touched in last 90 days
    complexityRaw: number;  // 0..100 already (mixed loc + cpxMax)
    fanInRaw: number;       // inDegree
    testDebtRaw: number;    // taintCount + blastCritical
    cycleRaw: number;       // 0..100 already (size-driven)
    loc: number;
  }

  // Max loc in set — used for complexity component's loc sub-mix.
  let maxLoc = 1;
  for (const f of graph.files) {
    if (f.loc > maxLoc) maxLoc = f.loc;
  }

  const raws: Raw[] = [];
  for (const f of graph.files) {
    const blameRec = graph.blame?.[f.id];
    let churnRaw = 0;
    if (blameRec && blameRec.entries.length > 0) {
      const totalLines = Math.max(1, blameRec.lineCount || f.loc || 1);
      let freshLines = 0;
      for (const e of blameRec.entries) {
        if (now - e.committedAt <= NINETY_DAYS_MS) {
          freshLines += Math.max(0, e.endLine - e.startLine + 1);
        }
      }
      churnRaw = Math.min(1, freshLines / totalLines);
    }

    const cpx = f.signals?.cpxMax ?? 0;
    const locPart = (f.loc / maxLoc) * 60;
    const cpxPart = Math.min(1, cpx / 20) * 40;
    const complexityRaw = clamp01to100(locPart + cpxPart);

    const fanInRaw = metrics.perFile.get(f.id)?.inDegree ?? 0;

    const taint = f.signals?.taintCount ?? 0;
    const blast = f.signals?.blastCritical ?? 0;
    const testDebtRaw = taint + blast;

    const sccSize = sccSizeByFile.get(f.id) ?? 0;
    const cycleRaw = sccSize > 1 ? Math.min(100, sccSize * 15) : 0;

    raws.push({
      fileId: f.id,
      churnRaw,
      complexityRaw,
      fanInRaw,
      testDebtRaw,
      cycleRaw,
      loc: f.loc,
    });
  }

  // Max per axis for normalization.
  let maxFanIn = 0;
  let maxTestDebt = 0;
  for (const r of raws) {
    if (r.fanInRaw > maxFanIn) maxFanIn = r.fanInRaw;
    if (r.testDebtRaw > maxTestDebt) maxTestDebt = r.testDebtRaw;
  }

  const scoresMap = new Map<string, RefactorRoiScore>();
  const ordered: RefactorRoiScore[] = [];
  for (const r of raws) {
    const churn = clamp01to100(r.churnRaw * 100);
    const complexity = clamp01to100(r.complexityRaw);
    const fanIn = normalizeToMax(r.fanInRaw, maxFanIn);
    const testDebt = normalizeToMax(r.testDebtRaw, maxTestDebt);
    const cycleMembership = clamp01to100(r.cycleRaw);

    const components: RefactorRoiComponents = {
      churn,
      complexity,
      fanIn,
      testDebt,
      cycleMembership,
    };

    const score = clamp01to100(
      weights.churn * churn +
        weights.complexity * complexity +
        weights.fanIn * fanIn +
        weights.testDebt * testDebt +
        weights.cycleMembership * cycleMembership,
    );

    const entry: RefactorRoiScore = {
      fileId: r.fileId,
      score,
      components,
      rank: 0,
    };
    scoresMap.set(r.fileId, entry);
    ordered.push(entry);
  }

  ordered.sort((a, b) => {
    const d = b.score - a.score;
    if (d !== 0) return d;
    return a.fileId < b.fileId ? -1 : a.fileId > b.fileId ? 1 : 0;
  });
  for (let i = 0; i < ordered.length; i++) ordered[i].rank = i + 1;

  const maxScore = ordered.length > 0 ? ordered[0].score : 0;
  return { scores: scoresMap, ordered, maxScore };
}
