import { materializeEdgeSet } from "@quanta/canvas-engine";
import type { CoChangeCell, CoChangeLayout, BuildCoChangeLayoutOpts } from "./types";

// build-cochange-layout
// --------------------------------------------------------------------
// Pure algorithm: WorkspaceGraph → CoChangeLayout.
//
// Co-change coupling: two files are coupled when they frequently appear
// in the same commit-delta together. This surfaces hidden coupling that
// import edges miss (e.g. a data contract shared by two callers, a
// shared test fixture, or mirrored config files).
//
// Algorithm:
//   For each consecutive snapshot pair (i, i+1):
//     1. Materialise edge sets at both indices.
//     2. Compute symmetric diff → changed edge IDs.
//     3. Expand each changed edge to its endpoint file IDs → changed files.
//     4. For each ordered pair (a, b) where both changed, increment
//        co-change[a][b] and co-change[b][a].
//     5. Track total per-file change counts for ranking.
//
// After the walk:
//   - Take top-N files by total change count.
//   - For each (i, j) pair in the top-N, compute ratio = cochange / union
//     (number of pairs where either changed).
//   - Interpolate color from bg1 (#ffffff) to blue (#3b82f6).
//
// Determinism: no Math.random(), no Date.now().

// ── Constants ─────────────────────────────────────────────────────────

const DEFAULT_MAX_FILES = 15;

// ── Color interpolation ──────────────────────────────────────────────
//
// Lerp from white (#ffffff) to Tailwind blue-500 (#3b82f6) in RGB space.

function lerpColor(ratio: number): string {
  const t = Math.max(0, Math.min(1, ratio));
  // bg1 = #ffffff = 255,255,255
  // blue = #3b82f6 = 59,130,246
  const r = Math.round(255 + (59  - 255) * t);
  const g = Math.round(255 + (130 - 255) * t);
  const b = Math.round(255 + (246 - 255) * t);
  return `rgb(${r},${g},${b})`;
}

// ── Mock data (shown when no git history is connected) ───────────────

function mockCoChangeLayout(): CoChangeLayout {
  const files = [
    "src/store/userStore.ts",
    "src/api/userApi.ts",
    "src/components/UserProfile.tsx",
    "src/hooks/useUser.ts",
    "src/utils/auth.ts",
    "src/components/NavBar.tsx",
  ];
  const names = ["userStore", "userApi", "UserProfile", "useUser", "auth", "NavBar"];
  const pairs: Array<[number, number, number, number]> = [
    // [ai, bi, cochangeCount, unionCount]
    [0, 1, 18, 22],
    [0, 2,  9, 24],
    [0, 3, 14, 19],
    [1, 2, 11, 20],
    [1, 4,  8, 18],
    [2, 3,  6, 21],
    [2, 5,  5, 17],
    [3, 4,  7, 16],
    [4, 5,  4, 15],
  ];
  const cells: CoChangeCell[] = pairs.map(([ai, bi, cochangeCount, unionCount]) => {
    const ratio = cochangeCount / unionCount;
    return {
      fileA: files[ai]!,
      fileB: files[bi]!,
      nameA: names[ai]!,
      nameB: names[bi]!,
      cochangeCount,
      totalSnapshots: unionCount,
      ratio,
      color: lerpColor(ratio),
    };
  });
  return {
    cells,
    fileOrder: files,
    fileNames: names,
    hasHistory: true,
    totalSnapshots: 28,
  };
}

// ── Main entry ───────────────────────────────────────────────────────

export function buildCoChangeLayout(
  opts: BuildCoChangeLayoutOpts,
): CoChangeLayout {
  const { graph } = opts;
  const maxFiles = opts.maxFiles ?? DEFAULT_MAX_FILES;

  // ── 1. Guard missing history ─────────────────────────────────────
  if (!graph.history || graph.history.snapshots.length < 2) {
    return mockCoChangeLayout();
  }

  const history = graph.history;
  const N = history.snapshots.length;

  // Build edge → (from, to) lookup for fast expansion.
  const edgeEndpoints = new Map<string, { from: string; to: string }>();
  for (const e of graph.fileEdges) {
    edgeEndpoints.set(e.id, { from: e.from, to: e.to });
  }

  // ── 2. Walk consecutive snapshot pairs ───────────────────────────
  //
  // co[a][b] = number of snapshots where both a and b changed.
  // totalChanges[a] = number of snapshots where a changed at all.
  const co = new Map<string, Map<string, number>>();
  const totalChanges = new Map<string, number>();

  let pairCount = 0;
  // Materialise snapshot 0 once; reuse as "prev" for the loop.
  let prevEdgeIds = materializeEdgeSet(history, 0);

  for (let i = 1; i < N; i++) {
    const currEdgeIds = materializeEdgeSet(history, i);

    // Symmetric diff: edges added or removed between i-1 and i.
    const changedFileIds = new Set<string>();

    for (const id of currEdgeIds) {
      if (!prevEdgeIds.has(id)) {
        // Added edge → both endpoints changed
        const ep = edgeEndpoints.get(id);
        if (ep) {
          changedFileIds.add(ep.from);
          changedFileIds.add(ep.to);
        }
      }
    }
    for (const id of prevEdgeIds) {
      if (!currEdgeIds.has(id)) {
        // Removed edge → both endpoints changed
        const ep = edgeEndpoints.get(id);
        if (ep) {
          changedFileIds.add(ep.from);
          changedFileIds.add(ep.to);
        }
      }
    }

    if (changedFileIds.size >= 2) {
      pairCount++;
      const changedArr = Array.from(changedFileIds);

      // Update totalChanges
      for (const fid of changedArr) {
        totalChanges.set(fid, (totalChanges.get(fid) ?? 0) + 1);
      }

      // Update co-change counts for every pair
      for (let ai = 0; ai < changedArr.length; ai++) {
        const a = changedArr[ai]!;
        for (let bi = ai + 1; bi < changedArr.length; bi++) {
          const b = changedArr[bi]!;

          let rowA = co.get(a);
          if (!rowA) { rowA = new Map(); co.set(a, rowA); }
          rowA.set(b, (rowA.get(b) ?? 0) + 1);

          let rowB = co.get(b);
          if (!rowB) { rowB = new Map(); co.set(b, rowB); }
          rowB.set(a, (rowB.get(a) ?? 0) + 1);
        }
      }
    }

    prevEdgeIds = currEdgeIds;
  }

  // ── 3. Rank files by total change count, take top-N ─────────────
  const sortedFiles = Array.from(totalChanges.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, maxFiles)
    .map(([fid]) => fid);

  if (sortedFiles.length === 0) {
    return {
      cells: [],
      fileOrder: [],
      fileNames: [],
      hasHistory: true,
      totalSnapshots: pairCount,
    };
  }

  // Build display-name lookup.
  const nameOf = new Map<string, string>();
  for (const f of graph.files) {
    nameOf.set(f.id, f.name);
  }

  const fileNames = sortedFiles.map(id => nameOf.get(id) ?? id);

  // ── 4. Build cells ───────────────────────────────────────────────
  //
  // We store upper-triangle only (i < j). The view mirrors them for
  // the lower triangle using symmetry.

  const cells: CoChangeCell[] = [];
  const fileSet = new Set(sortedFiles);
  // changesForFile: how many pairs either file changed (union counting)
  // = totalChanges[a] + totalChanges[b] - co[a][b]
  // This is the Jaccard denominator.

  for (let ai = 0; ai < sortedFiles.length; ai++) {
    const a = sortedFiles[ai]!;
    for (let bi = ai + 1; bi < sortedFiles.length; bi++) {
      const b = sortedFiles[bi]!;
      if (!fileSet.has(a) || !fileSet.has(b)) continue;

      const cochangeCount = co.get(a)?.get(b) ?? 0;
      const changesA = totalChanges.get(a) ?? 0;
      const changesB = totalChanges.get(b) ?? 0;
      // Union: how many pairs did at least one of a, b change?
      const unionCount = changesA + changesB - cochangeCount;
      const ratio = unionCount > 0 ? cochangeCount / unionCount : 0;

      cells.push({
        fileA: a,
        fileB: b,
        nameA: nameOf.get(a) ?? a,
        nameB: nameOf.get(b) ?? b,
        cochangeCount,
        totalSnapshots: unionCount,
        ratio,
        color: lerpColor(ratio),
      });
    }
  }

  return {
    cells,
    fileOrder: sortedFiles,
    fileNames,
    hasHistory: true,
    totalSnapshots: pairCount,
  };
}
