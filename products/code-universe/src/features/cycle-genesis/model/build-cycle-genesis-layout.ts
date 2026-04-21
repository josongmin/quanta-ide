// build-cycle-genesis-layout
// --------------------------------------------------------------------
// Pure algorithm: WorkspaceGraph → CycleGenesisLayout.
//
// Algorithm overview:
//   1. Guard: if graph.history is absent, return empty layout.
//   2. Find all non-trivial SCCs via findStronglyConnectedComponents.
//   3. Build a full edgeIndex from graph.fileEdges.
//   4. For each SCC with ≥2 members, call findCycleGenesis.
//   5. Assemble CycleGenesisRow entries.
//   6. Sort rows oldest-first (pre-history rows first, then by timestamp asc).
//   7. Compute timeline x positions in [0..1].
//   8. Compute age labels and circle colours.
//
// Determinism: no Math.random, no Map iteration without explicit sort,
// nowMs is injected so tests can pin the clock.

import {
  findStronglyConnectedComponents,
  findCycleGenesis,
} from "@quanta/canvas-engine";
import type { FileEdge } from "@quanta/canvas-engine";
import type {
  BuildCycleGenesisLayoutOpts,
  CycleGenesisLayout,
  CycleGenesisRow,
} from "./types";

// ── Helpers ───────────────────────────────────────────────────────────

/** Derive a short "A ↔ B ↔ C" style label from a list of file-id members. */
function makeMemberLabel(members: readonly string[]): string {
  const SHORT_MAX = 3;
  const short = members.map(m => {
    // Take last two path segments, e.g. "src/vm/store.ts" → "vm/store"
    const parts = m.replace(/\.[^./]+$/, "").split("/");
    return parts.slice(-2).join("/");
  });
  if (short.length <= SHORT_MAX) return short.join(" ↔ ");
  return short.slice(0, SHORT_MAX).join(" ↔ ") + ` +${short.length - SHORT_MAX}`;
}

/**
 * Human-readable relative age from a timestamp to nowMs.
 * Returns strings like "2 days ago", "3 months ago", "1 year ago".
 */
function relativeAge(timestampMs: number, nowMs: number): string {
  const diffMs = Math.max(0, nowMs - timestampMs);
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 1) return "today";
  if (diffDays === 1) return "1 day ago";
  if (diffDays < 30) return `${diffDays} days ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) return "1 month ago";
  if (diffMonths < 12) return `${diffMonths} months ago`;
  const diffYears = Math.floor(diffMonths / 12);
  if (diffYears === 1) return "1 year ago";
  return `${diffYears} years ago`;
}

/**
 * Red gradient colour based on age: older → darker red (higher age fraction →
 * darker). fraction is 0 (newest) .. 1 (oldest).
 */
function cycleColor(ageFraction: number): string {
  // Lightness range: oldest = L40 (dark red), newest = L65 (bright red).
  const l = Math.round(65 - ageFraction * 25);
  return `hsl(0, 72%, ${l}%)`;
}

/** Stable row id derived from sorted SCC members. */
function rowId(members: readonly string[]): string {
  return [...members].sort().join("|");
}

// ── Mock data (shown when no git history or no cycles) ───────────────

function mockCycleGenesisLayout(nowMs: number): CycleGenesisLayout {
  const DAY = 86_400_000;
  const rows: CycleGenesisRow[] = [
    {
      id: "src/store/cartStore.ts|src/domain/orderService.ts|src/api/checkoutApi.ts",
      sccMembers: ["src/store/cartStore.ts", "src/domain/orderService.ts", "src/api/checkoutApi.ts"],
      memberLabel: "store/cartStore ↔ domain/orderService ↔ api/checkoutApi",
      formedAtSha: "a1b2c3d",
      formedAtTimestamp: nowMs - 120 * DAY,
      timelineX: 0.15,
      ageLabel: "4 months ago",
      circleColor: cycleColor(1),
      introducingEdge: { from: "src/api/checkoutApi.ts", to: "src/store/cartStore.ts", kind: "import" },
      beforeFormation: [],
      predatesHistory: false,
    },
    {
      id: "src/utils/helpers.ts|src/domain/userService.ts",
      sccMembers: ["src/utils/helpers.ts", "src/domain/userService.ts"],
      memberLabel: "utils/helpers ↔ domain/userService",
      formedAtSha: "b2c3d4e",
      formedAtTimestamp: nowMs - 75 * DAY,
      timelineX: 0.4,
      ageLabel: "2 months ago",
      circleColor: cycleColor(0.6),
      introducingEdge: { from: "src/domain/userService.ts", to: "src/utils/helpers.ts", kind: "import" },
      beforeFormation: [],
      predatesHistory: false,
    },
    {
      id: "src/infra/db.ts|src/domain/reportService.ts|src/store/reportStore.ts",
      sccMembers: ["src/infra/db.ts", "src/domain/reportService.ts", "src/store/reportStore.ts"],
      memberLabel: "infra/db ↔ domain/reportService ↔ store/reportStore",
      formedAtSha: "c3d4e5f",
      formedAtTimestamp: nowMs - 30 * DAY,
      timelineX: 0.75,
      ageLabel: "1 month ago",
      circleColor: cycleColor(0.25),
      introducingEdge: { from: "src/store/reportStore.ts", to: "src/infra/db.ts", kind: "import" },
      beforeFormation: [],
      predatesHistory: false,
    },
    {
      id: "src/auth/authService.ts|src/api/sessionApi.ts",
      sccMembers: ["src/auth/authService.ts", "src/api/sessionApi.ts"],
      memberLabel: "auth/authService ↔ api/sessionApi",
      formedAtSha: "d4e5f6a",
      formedAtTimestamp: nowMs - 8 * DAY,
      timelineX: 0.95,
      ageLabel: "8 days ago",
      circleColor: cycleColor(0.05),
      introducingEdge: { from: "src/api/sessionApi.ts", to: "src/auth/authService.ts", kind: "import" },
      beforeFormation: [],
      predatesHistory: false,
    },
  ];
  const earliest = rows[0]!.formedAtTimestamp!;
  return { rows, earliestTimestamp: earliest, nowTimestamp: nowMs };
}

// ── Main entry ────────────────────────────────────────────────────────

export function buildCycleGenesisLayout(
  opts: BuildCycleGenesisLayoutOpts,
): CycleGenesisLayout {
  const { graph } = opts;
  const nowMs = opts.nowMs ?? Date.now();

  // ── 1. Guard: history required ────────────────────────────────────
  if (!graph.history) return mockCycleGenesisLayout(nowMs);
  const history = graph.history;

  // ── 2. Find SCCs ──────────────────────────────────────────────────
  const sccResult = findStronglyConnectedComponents({ fileEdges: graph.fileEdges });
  // sccResult.components contains only non-trivial SCCs (size ≥ 2 or self-loop)
  // Filter strictly to ≥ 2 distinct members.
  const validComponents = sccResult.components.filter(c => c.length >= 2);
  if (validComponents.length === 0) return mockCycleGenesisLayout(nowMs);

  // ── 3. Build edgeIndex ────────────────────────────────────────────
  const edgeIndex = new Map<string, FileEdge>(
    graph.fileEdges.map(e => [e.id, e]),
  );

  // ── 4 & 5. Call findCycleGenesis and build rows ───────────────────
  const rawRows: CycleGenesisRow[] = [];

  // Sort components for stable ordering before processing.
  const sortedComponents = [...validComponents].sort((a, b) => {
    const ka = [...a].sort().join("|");
    const kb = [...b].sort().join("|");
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });

  for (const comp of sortedComponents) {
    const genesis = findCycleGenesis(comp, history, edgeIndex);
    const formedAtTimestamp = genesis.formedAtTimestamp ?? null;
    const predatesHistory = genesis.formedAtSha === null;

    rawRows.push({
      id: rowId(genesis.sccMembers),
      sccMembers: genesis.sccMembers,
      memberLabel: makeMemberLabel(genesis.sccMembers),
      formedAtSha: genesis.formedAtSha,
      formedAtTimestamp,
      // Placeholder x — computed in step 7.
      timelineX: 0,
      // Placeholder labels — computed in step 8.
      ageLabel: "",
      circleColor: "",
      introducingEdge: genesis.introducingEdge,
      beforeFormation: genesis.beforeFormation,
      predatesHistory,
    });
  }

  // ── 6. Sort: pre-history first, then oldest-first by timestamp ────
  rawRows.sort((a, b) => {
    // Pre-history rows go leftmost.
    if (a.predatesHistory && !b.predatesHistory) return -1;
    if (!a.predatesHistory && b.predatesHistory) return 1;
    if (a.predatesHistory && b.predatesHistory) return a.id < b.id ? -1 : 1;
    // Both have timestamps — oldest first.
    const ta = a.formedAtTimestamp ?? 0;
    const tb = b.formedAtTimestamp ?? 0;
    if (ta !== tb) return ta - tb;
    return a.id < b.id ? -1 : 1;
  });

  // ── 7. Compute timeline x positions ──────────────────────────────
  const knownTimestamps = rawRows
    .map(r => r.formedAtTimestamp)
    .filter((t): t is number => t !== null);

  const earliestTimestamp =
    knownTimestamps.length > 0 ? Math.min(...knownTimestamps) : null;

  const timespan =
    earliestTimestamp !== null ? nowMs - earliestTimestamp : 0;

  for (const row of rawRows) {
    if (row.predatesHistory || row.formedAtTimestamp === null) {
      // Pre-dates history: pin to the left.
      row.timelineX = 0;
    } else if (timespan <= 0) {
      row.timelineX = 1;
    } else {
      row.timelineX = Math.max(
        0.02,
        Math.min(0.98, (row.formedAtTimestamp - earliestTimestamp!) / timespan),
      );
    }
  }

  // ── 8. Age labels and colours ─────────────────────────────────────
  // ageFraction: 0 = newest, 1 = oldest (for colour gradient).
  const maxAge =
    knownTimestamps.length > 0
      ? nowMs - Math.min(...knownTimestamps)
      : 0;

  for (const row of rawRows) {
    if (row.predatesHistory || row.formedAtTimestamp === null) {
      row.ageLabel = "predates history";
      row.circleColor = cycleColor(1);
    } else {
      row.ageLabel = relativeAge(row.formedAtTimestamp, nowMs);
      const ageFrac = maxAge > 0 ? (nowMs - row.formedAtTimestamp) / maxAge : 0;
      row.circleColor = cycleColor(Math.min(1, Math.max(0, ageFrac)));
    }
  }

  return {
    rows: rawRows,
    earliestTimestamp,
    nowTimestamp: nowMs,
  };
}
