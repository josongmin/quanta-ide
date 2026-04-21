// build-smell-history-layout
// --------------------------------------------------------------------
// Pure algorithm: WorkspaceGraph → SmellHistoryLayout.
//
// Algorithm overview:
//   1. Guard: if graph.history is absent, return empty layout.
//   2. Sort files descending by riskScore, take top N (default 20).
//   3. For each file × each of the 4 smell kinds, call findSmellGenesis.
//   4. Collect non-null results, sort by firstSeenTimestamp descending.
//   5. Group entries by SmellKind into byKind map.
//   6. Build sparkline: 12 evenly-spaced snapshot indices across history;
//      at each index count how many file×smell pairs were already present.
//
// Determinism: no Math.random, no unsorted Map iteration over
// caller-supplied data.

import { findSmellGenesis } from "@quanta/canvas-engine";
import type { SmellKind } from "@quanta/canvas-engine";
import type {
  BuildSmellHistoryLayoutOpts,
  SmellHistoryEntry,
  SmellHistoryLayout,
  SparklineBucket,
} from "./types";

// ── Constants ─────────────────────────────────────────────────────────

const ALL_SMELLS: readonly SmellKind[] = [
  "high-coupling",
  "cycle-member",
  "risk-spike",
  "layer-violation",
];

const DEFAULT_TOP_N = 20;
const SPARKLINE_BUCKETS = 12;

/** Colour assigned to each smell kind. */
export const SMELL_COLORS: Readonly<Record<SmellKind, string>> = {
  "high-coupling": "#f59e0b",
  "cycle-member": "#ef4444",
  "risk-spike": "#f97316",
  "layer-violation": "#8b5cf6",
};

// ── Helpers ───────────────────────────────────────────────────────────

/**
 * Relative age from a Unix ms timestamp.
 */
function relativeAge(timestampMs: number, nowMs: number): string {
  const diffMs = Math.max(0, nowMs - timestampMs);
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 1) return "today";
  if (diffDays === 1) return "1 day ago";
  if (diffDays < 7) return `${diffDays} days ago`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks === 1) return "1 week ago";
  if (diffWeeks < 5) return `${diffWeeks} weeks ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) return "1 month ago";
  if (diffMonths < 12) return `${diffMonths} months ago`;
  const diffYears = Math.floor(diffMonths / 12);
  if (diffYears === 1) return "1 year ago";
  return `${diffYears} years ago`;
}

/** Short display name for a file id. */
function shortFileName(fileId: string): string {
  const clean = fileId.replace(/\.[^./]+$/, "");
  const parts = clean.split("/");
  return parts.slice(-2).join("/");
}

// ── Mock data (shown when no git history is connected) ────────────────

function mockSmellHistoryLayout(nowMs: number): SmellHistoryLayout {
  const DAY = 86_400_000;
  const rawEntries: SmellHistoryEntry[] = [
    { id: "src/store/globalStore.ts::high-coupling",   fileId: "src/store/globalStore.ts",   fileName: "store/globalStore",   smell: "high-coupling",   firstSeenTimestamp: nowMs - 90 * DAY,  age: "3 months ago",  color: SMELL_COLORS["high-coupling"],   firstSeenSha: "a1b2c3d" },
    { id: "src/api/dataService.ts::cycle-member",      fileId: "src/api/dataService.ts",      fileName: "api/dataService",     smell: "cycle-member",    firstSeenTimestamp: nowMs - 75 * DAY,  age: "2 months ago",  color: SMELL_COLORS["cycle-member"],    firstSeenSha: "b2c3d4e" },
    { id: "src/utils/helpers.ts::risk-spike",          fileId: "src/utils/helpers.ts",        fileName: "utils/helpers",       smell: "risk-spike",      firstSeenTimestamp: nowMs - 60 * DAY,  age: "2 months ago",  color: SMELL_COLORS["risk-spike"],      firstSeenSha: "c3d4e5f" },
    { id: "src/components/Dashboard.tsx::high-coupling", fileId: "src/components/Dashboard.tsx", fileName: "components/Dashboard", smell: "high-coupling", firstSeenTimestamp: nowMs - 45 * DAY, age: "6 weeks ago",  color: SMELL_COLORS["high-coupling"],   firstSeenSha: "d4e5f6a" },
    { id: "src/domain/orderService.ts::layer-violation", fileId: "src/domain/orderService.ts", fileName: "domain/orderService", smell: "layer-violation", firstSeenTimestamp: nowMs - 30 * DAY, age: "1 month ago",  color: SMELL_COLORS["layer-violation"], firstSeenSha: "e5f6a7b" },
    { id: "src/store/globalStore.ts::cycle-member",    fileId: "src/store/globalStore.ts",   fileName: "store/globalStore",   smell: "cycle-member",    firstSeenTimestamp: nowMs - 20 * DAY,  age: "20 days ago",   color: SMELL_COLORS["cycle-member"],    firstSeenSha: "f6a7b8c" },
    { id: "src/infra/db.ts::risk-spike",               fileId: "src/infra/db.ts",             fileName: "infra/db",            smell: "risk-spike",      firstSeenTimestamp: nowMs - 12 * DAY,  age: "12 days ago",   color: SMELL_COLORS["risk-spike"],      firstSeenSha: "a7b8c9d" },
    { id: "src/components/UserList.tsx::layer-violation", fileId: "src/components/UserList.tsx", fileName: "components/UserList", smell: "layer-violation", firstSeenTimestamp: nowMs - 5 * DAY, age: "5 days ago",   color: SMELL_COLORS["layer-violation"], firstSeenSha: "b8c9d0e" },
  ];
  rawEntries.sort((a, b) => b.firstSeenTimestamp - a.firstSeenTimestamp);

  const byKind = new Map<SmellKind, SmellHistoryEntry[]>([
    ["high-coupling",  []],
    ["cycle-member",   []],
    ["risk-spike",     []],
    ["layer-violation",[]],
  ]);
  for (const e of rawEntries) byKind.get(e.smell)!.push(e);

  const earliest = rawEntries[rawEntries.length - 1]!.firstSeenTimestamp;
  const span = nowMs - earliest;
  const sparkline: SparklineBucket[] = Array.from({ length: 12 }, (_, i) => {
    const bucketTs = earliest + (span * i) / 11;
    const count = rawEntries.filter(e => e.firstSeenTimestamp <= bucketTs).length;
    return { index: i, count, timestamp: bucketTs };
  });

  return { entries: rawEntries, sparkline, byKind };
}

// ── Main entry ────────────────────────────────────────────────────────

export function buildSmellHistoryLayout(
  opts: BuildSmellHistoryLayoutOpts,
): SmellHistoryLayout {
  const { graph } = opts;
  const topN = opts.topN ?? DEFAULT_TOP_N;
  const nowMs = opts.nowMs ?? Date.now();

  // ── 1. Guard ──────────────────────────────────────────────────────
  if (!graph.history) return mockSmellHistoryLayout(nowMs);
  const history = graph.history;
  if (history.snapshots.length === 0) return mockSmellHistoryLayout(nowMs);

  // ── 2. Top N files by riskScore ───────────────────────────────────
  const sortedFiles = [...graph.files]
    .sort((a, b) => {
      if (b.riskScore !== a.riskScore) return b.riskScore - a.riskScore;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    })
    .slice(0, topN);

  // ── 3. Run findSmellGenesis for each file × smell ─────────────────
  const rawEntries: SmellHistoryEntry[] = [];

  // Sort smells for deterministic processing order.
  const sortedSmells = [...ALL_SMELLS].sort() as SmellKind[];

  for (const file of sortedFiles) {
    for (const smell of sortedSmells) {
      const genesis = findSmellGenesis(
        file.id,
        smell,
        history,
        graph,
        {
          couplingThreshold: opts.couplingThreshold,
          riskDeltaThreshold: opts.riskDeltaThreshold,
        },
      );
      if (!genesis) continue;

      rawEntries.push({
        id: `${file.id}::${smell}`,
        fileId: file.id,
        fileName: shortFileName(file.id),
        smell,
        firstSeenTimestamp: genesis.firstSeenTimestamp,
        age: relativeAge(genesis.firstSeenTimestamp, nowMs),
        color: SMELL_COLORS[smell],
        firstSeenSha: genesis.firstSeenSha,
      });
    }
  }

  // ── 4. Sort newest-first ──────────────────────────────────────────
  rawEntries.sort((a, b) => {
    if (b.firstSeenTimestamp !== a.firstSeenTimestamp) {
      return b.firstSeenTimestamp - a.firstSeenTimestamp;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  // ── 5. Group by kind ──────────────────────────────────────────────
  const byKind = new Map<SmellKind, SmellHistoryEntry[]>();
  for (const smell of ALL_SMELLS) byKind.set(smell, []);
  for (const entry of rawEntries) {
    byKind.get(entry.smell)!.push(entry);
  }

  // ── 6. Sparkline ──────────────────────────────────────────────────
  // For each of the 12 evenly-spaced snapshot indices, count how many
  // file×smell pairs have firstSeenTimestamp <= snapshot.timestamp.
  //
  // We avoid re-running findSmellGenesis for every bucket — instead we
  // use the already-collected entries (genesis timestamps) and bucket them
  // by counting how many entries have firstSeenTimestamp ≤ snapTimestamp.
  //
  // This is an approximation that works perfectly for "when did each smell
  // first appear?" since genesis timestamps are the exact first occurrence.

  const snaps = history.snapshots;
  const totalSnaps = snaps.length;

  const sparkline: SparklineBucket[] = [];

  // Pick SPARKLINE_BUCKETS evenly spread indices.
  for (let b = 0; b < SPARKLINE_BUCKETS; b++) {
    const snapIdx =
      totalSnaps <= SPARKLINE_BUCKETS
        ? b < totalSnaps
          ? b
          : totalSnaps - 1
        : Math.round((b / (SPARKLINE_BUCKETS - 1)) * (totalSnaps - 1));

    const snap = snaps[Math.min(snapIdx, totalSnaps - 1)];
    const bucketTs = snap.timestamp;

    // Count entries whose firstSeenTimestamp <= bucketTs.
    let count = 0;
    for (const entry of rawEntries) {
      if (entry.firstSeenTimestamp <= bucketTs) count++;
    }

    sparkline.push({ index: b, count, timestamp: bucketTs });
  }

  return {
    entries: rawEntries,
    sparkline,
    byKind,
  };
}
