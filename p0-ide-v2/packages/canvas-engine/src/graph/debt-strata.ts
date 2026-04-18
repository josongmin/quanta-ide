import type { WorkspaceGraph } from "./types";

// Per-file horizontal strata — older lines settle as heavier layers.
// Surfaces "how much crystallized debt lives under each file" for the
// Action Terrain overlay. Age weighting is fixed so strata colours stay
// stable between sessions.

export interface DebtLayer {
  ageBucketMonths: number;
  lineCount: number;
  accumulatedDebt: number;
}

export interface DebtStrataResult {
  perFile: ReadonlyMap<string, readonly DebtLayer[]>;
  globalMaxDebt: number;
}

const MS_PER_MONTH = 1000 * 86_400 * 30.44;

// Bucket upper bounds in months. Infinity bucket catches the long tail.
const BUCKETS: readonly number[] = [3, 6, 12, 24, Infinity];

const AGE_WEIGHT: Readonly<Record<string, number>> = {
  "3": 0.3,
  "6": 0.5,
  "12": 0.7,
  "24": 0.9,
  Infinity: 1.0,
};

function bucketKey(upper: number): string {
  return upper === Infinity ? "Infinity" : String(upper);
}

function bucketIndexFor(ageMonths: number): number {
  for (let i = 0; i < BUCKETS.length; i++) {
    if (ageMonths < BUCKETS[i]) return i;
  }
  return BUCKETS.length - 1;
}

export function computeDebtStrata(
  graph: Pick<WorkspaceGraph, "files" | "blame">,
  now: number = Date.now(),
): DebtStrataResult {
  const perFile = new Map<string, readonly DebtLayer[]>();
  let globalMaxDebt = 0;

  if (!graph.blame) {
    return { perFile, globalMaxDebt };
  }

  for (const f of graph.files) {
    const blame = graph.blame[f.id];
    if (!blame || blame.entries.length === 0) continue;

    // Per-bucket accumulators: line count and a Set of authors.
    const lineCounts = new Array<number>(BUCKETS.length).fill(0);
    const authors: Set<string>[] = BUCKETS.map(() => new Set<string>());
    let totalLines = 0;

    for (const e of blame.entries) {
      const lines = Math.max(0, e.endLine - e.startLine + 1);
      if (lines === 0) continue;
      const ageMs = Math.max(0, now - e.committedAt);
      const ageMonths = ageMs / MS_PER_MONTH;
      const idx = bucketIndexFor(ageMonths);
      lineCounts[idx] += lines;
      authors[idx].add(e.author);
      totalLines += lines;
    }

    const fileTotal = Math.max(1, blame.lineCount || totalLines || f.loc || 1);
    const layers: DebtLayer[] = [];
    for (let i = 0; i < BUCKETS.length; i++) {
      const count = lineCounts[i];
      if (count <= 0) continue;
      const upper = BUCKETS[i];
      const ageWeight = AGE_WEIGHT[bucketKey(upper)];
      const locFraction = Math.min(1, count / fileTotal);
      const diversity = Math.min(1, authors[i].size / 4);
      // bus-factor proxy: diversity multiplies a 0.5..1.0 envelope so a
      // single-author bucket still contributes, but a multi-author one
      // weighs ~2x heavier.
      const debt = Math.max(
        0,
        Math.min(100, locFraction * ageWeight * (0.5 + 0.5 * diversity) * 100),
      );
      layers.push({
        ageBucketMonths: upper,
        lineCount: count,
        accumulatedDebt: debt,
      });
      if (debt > globalMaxDebt) globalMaxDebt = debt;
    }

    if (layers.length > 0) {
      layers.sort((a, b) => a.ageBucketMonths - b.ageBucketMonths);
      perFile.set(f.id, layers);
    }
  }

  return { perFile, globalMaxDebt };
}
