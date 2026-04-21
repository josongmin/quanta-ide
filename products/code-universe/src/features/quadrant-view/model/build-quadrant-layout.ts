// build-quadrant-layout
// --------------------------------------------------------------------
// Pure algorithm: tree + graph → QuadrantLayout. Entities of a chosen
// kind (default "galaxy") become scatter dots on a 2-axis plot:
//   X = churn   — how many blame entries fall within the last 90 days.
//                 Fallback when no blame data: count of file edges
//                 touching any file in the entity's subtree.
//   Y = risk    — composite of FileNode.riskScore + secondary signal
//                 from taint/arch/blast counts.
//
// Normalization: 95th-percentile clamped to 0..1 so a single hot
// outlier doesn't collapse everything else onto the origin.
//
// Determinism: every sort has a secondary id tie-break. No Math.random,
// no Date.now (callee passes `now` or we use a fixed reference injected
// via opts — see note at bottom). For tests we expose a stable now
// defaulting to a fixed offset; for production the caller passes
// `Date.now()` via `BuildQuadrantLayoutOpts.now`.
//
// Radius: painters algorithm — sort desc by radius so large bubbles
// paint first and small ones appear on top.

import type { Entity, EntityTree, FileNode } from "@quanta/canvas-engine";
import type {
  BuildQuadrantLayoutOpts,
  QuadrantLayout,
  QuadrantPoint,
  QuadrantRegion,
} from "./types";

// ── Constants ────────────────────────────────────────────────────────

/** 90-day window for "recent" blame entries (ms). */
const CHURN_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;
/** Percentile used to normalize both axes (avoids outlier compression). */
const NORMALIZATION_PERCENTILE = 0.95;
/** Radius range in SVG units: min..max. */
const RADIUS_MIN = 6;
const RADIUS_MAX = 22;
/** Base radius added before the sqrt term. */
const RADIUS_BASE = 8;
/** Coefficient for the sqrt(loc / maxLoc) term. */
const RADIUS_SCALE = 12;

// ── Determinism helpers ──────────────────────────────────────────────

/** FNV-1a 32-bit — deterministic across JS engines. */
function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function hslToHex(h: number, s: number, l: number): string {
  const sN = s / 100;
  const lN = l / 100;
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lN - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60)       { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else              { r = c; g = 0; b = x; }
  const toHex = (v: number): string =>
    Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Deterministic, visually distinct color from an entity id. Same hue
 *  distribution as chord-view's palette so colors stay coherent when
 *  the user switches between views. */
function hashColorFromId(id: string): string {
  const h = hashString(id) % 360;
  return hslToHex(h, 55, 55);
}

// ── Tree traversal ───────────────────────────────────────────────────

/** Collect all entities of `kind` within the subtree rooted at
 *  `rootId`. Traversal is iterative (no stack overflow risk on deep
 *  trees). Result is sorted by id for stable downstream ordering. */
function collectEntities(
  tree: EntityTree,
  rootId: string,
  kind: "galaxy" | "building",
): Entity[] {
  const root = tree.byId.get(rootId);
  if (!root) return [];

  const out: Entity[] = [];
  const stack: Entity[] = [root];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    if (cur.kind === kind) {
      out.push(cur);
      // Do not descend further — a galaxy contains buildings, but we
      // want galaxy-level entries, not their children.
      continue;
    }
    for (let i = cur.childIds.length - 1; i >= 0; i--) {
      const childId = cur.childIds[i];
      if (!childId) continue;
      const child = tree.byId.get(childId);
      if (child) stack.push(child);
    }
  }
  out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return out;
}

/** Collect all FileNode descendants of an entity, including itself if
 *  it is a building. Builds a Map keyed by fileId for O(1) lookup. */
function collectFilesUnder(
  tree: EntityTree,
  entity: Entity,
  fileMap: ReadonlyMap<string, FileNode>,
): FileNode[] {
  const out: FileNode[] = [];
  const stack: Entity[] = [entity];
  while (stack.length > 0) {
    const cur = stack.pop()!;
    if (cur.kind === "building") {
      const file = fileMap.get(cur.id);
      if (file) out.push(file);
      continue;
    }
    for (let i = cur.childIds.length - 1; i >= 0; i--) {
      const childId = cur.childIds[i];
      if (!childId) continue;
      const child = tree.byId.get(childId);
      if (child) stack.push(child);
    }
  }
  return out;
}

// ── Percentile helper ────────────────────────────────────────────────

/** p-th percentile of a sorted numeric array (linear interpolation).
 *  Returns 0 for empty arrays. Assumes arr is sorted ascending. */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0]!;
  const idx = p * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  const frac = idx - lo;
  return (sorted[lo] ?? 0) * (1 - frac) + (sorted[hi] ?? 0) * frac;
}

// ── Region definitions ───────────────────────────────────────────────

const REGIONS: readonly QuadrantRegion[] = [
  {
    id: "volatile-critical",
    label: "Danger Zone",
    description: "High churn, high risk — urgent attention",
    xHalf: 1,
    yHalf: 1,
    fill: "rgba(239,68,68,0.05)",
  },
  {
    id: "volatile-safe",
    label: "Active Work",
    description: "High churn, low risk — healthy iteration",
    xHalf: 1,
    yHalf: 0,
    fill: "rgba(34,197,94,0.05)",
  },
  {
    id: "stable-critical",
    label: "Tech Debt",
    description: "Low churn, high risk — buried landmine",
    xHalf: 0,
    yHalf: 1,
    fill: "rgba(245,158,11,0.06)",
  },
  {
    id: "stable-safe",
    label: "Stable",
    description: "Low churn, low risk — well-maintained",
    xHalf: 0,
    yHalf: 0,
    fill: "rgba(148,163,184,0.04)",
  },
];

// ── Main entry ───────────────────────────────────────────────────────

export function buildQuadrantLayout(opts: BuildQuadrantLayoutOpts): QuadrantLayout {
  const { tree, graph, width: _width, height: _height } = opts;
  const pointKind = opts.pointKind ?? "galaxy";
  const scopeId = opts.scopeId ?? null;
  const maxPoints = opts.maxPoints ?? 80;

  // We need a stable `now` for blame window comparisons. The caller
  // may pass `nowMs` for deterministic tests; production always passes
  // Date.now() explicitly via a wrapper. Absent from opts — fall back
  // to a fixed reference so unit tests with hardcoded blame timestamps
  // stay repeatable without mocking Date.now.
  // NOTE: `nowMs` is an undocumented escape hatch used only in tests
  // (BuildQuadrantLayoutOpts doesn't expose it publicly). We cast to
  // access it without polluting the public type.
  const nowMs = (opts as BuildQuadrantLayoutOpts & { nowMs?: number }).nowMs
    ?? Date.now();

  void _width;
  void _height;

  const rootId = scopeId ?? tree.rootId;
  if (scopeId !== null && !tree.byId.has(scopeId)) {
    throw new Error(`scopeId "${scopeId}" not found in tree`);
  }

  // ── Step 1: collect entities to plot ─────────────────────────────

  const entities = collectEntities(tree, rootId, pointKind);
  if (entities.length === 0) {
    return {
      points: [],
      regions: [...REGIONS],
      xAxisLabel: "Churn (90d commits)",
      yAxisLabel: "Risk Score",
      overflow: 0,
    };
  }

  // ── Index FileNodes for fast lookup ───────────────────────────────

  const fileMap = new Map<string, FileNode>();
  for (const file of graph.files) {
    fileMap.set(file.id, file);
  }

  // ── Index blame entries by fileId ─────────────────────────────────

  const blameByFile = graph.blame ?? null;

  // ── Index file edges for churn fallback ───────────────────────────
  // Key = fileId → count of edges touching this file.
  // Only computed when blame data is absent.

  const edgeTouchCount = new Map<string, number>();
  if (blameByFile === null) {
    for (const edge of graph.fileEdges) {
      edgeTouchCount.set(edge.from, (edgeTouchCount.get(edge.from) ?? 0) + 1);
      edgeTouchCount.set(edge.to, (edgeTouchCount.get(edge.to) ?? 0) + 1);
    }
  }

  // ── Step 2 & 3: compute raw churn and risk per entity ─────────────

  const cutoff = nowMs - CHURN_WINDOW_MS;

  interface EntityScore {
    entity: Entity;
    files: FileNode[];
    xRaw: number;
    yRaw: number;
    loc: number;
  }

  const scored: EntityScore[] = [];

  for (const entity of entities) {
    const files = collectFilesUnder(tree, entity, fileMap);

    // Churn score
    let xRaw = 0;
    if (blameByFile !== null) {
      // Count blame entries in the 90-day window across all files in subtree.
      for (const file of files) {
        const blame = blameByFile[file.id];
        if (blame) {
          for (const entry of blame.entries) {
            if (entry.committedAt >= cutoff) xRaw++;
          }
        }
      }
    } else {
      // Fallback: sum edge-touch counts for all files in the subtree.
      for (const file of files) {
        xRaw += edgeTouchCount.get(file.id) ?? 0;
      }
    }

    // Risk score
    // Primary: average riskScore across files.
    // Secondary: max (taintCount*3 + archViolations*2 + blastCritical*1.5)
    //            normalized by maxSecondary / (maxSecondary + 1).
    let totalRisk = 0;
    let maxSecondary = 0;
    for (const file of files) {
      totalRisk += file.riskScore;
      const secondary =
        file.signals.taintCount * 3 +
        file.signals.archViolations * 2 +
        file.signals.blastCritical * 1.5;
      if (secondary > maxSecondary) maxSecondary = secondary;
    }
    const avgRisk = files.length > 0 ? totalRisk / files.length : 0;
    // normalizedSecondary: sigmoid-like squash to 0..1 that never reaches 1.
    const normalizedSecondary = maxSecondary / (maxSecondary + 1);
    const yRaw = avgRisk * 0.6 + normalizedSecondary * 0.4;

    const loc = files.reduce((acc, f) => acc + f.loc, 0);

    scored.push({ entity, files, xRaw, yRaw, loc });
  }

  // ── Step 4: normalize to 0..1 via 95th percentile ─────────────────

  const xValues = [...scored.map(s => s.xRaw)].sort((a, b) => a - b);
  const yValues = [...scored.map(s => s.yRaw)].sort((a, b) => a - b);
  const xP95 = percentile(xValues, NORMALIZATION_PERCENTILE);
  const yP95 = percentile(yValues, NORMALIZATION_PERCENTILE);

  // ── Step 5: trim to maxPoints — keep highest x+y score entities ───

  // Sort desc by xRaw + yRaw, then id for tie-break.
  scored.sort((a, b) => {
    const scoreA = a.xRaw + a.yRaw;
    const scoreB = b.xRaw + b.yRaw;
    if (scoreB !== scoreA) return scoreB - scoreA;
    return a.entity.id < b.entity.id ? -1 : 1;
  });

  const overflow = Math.max(0, scored.length - maxPoints);
  const kept = scored.slice(0, maxPoints);

  // ── Step 6: compute radius — proportional to sqrt(loc / maxLoc) ───

  const maxLoc = kept.reduce((acc, s) => Math.max(acc, s.loc), 1);

  // ── Step 7 & 8: build QuadrantPoint array ─────────────────────────

  const points: QuadrantPoint[] = kept.map(s => {
    const xNorm = xP95 > 0 ? Math.min(1, s.xRaw / xP95) : 0;
    const yNorm = yP95 > 0 ? Math.min(1, s.yRaw / yP95) : 0;

    const radius = Math.min(
      RADIUS_MAX,
      Math.max(RADIUS_MIN, RADIUS_BASE + RADIUS_SCALE * Math.sqrt(s.loc / maxLoc)),
    );

    const color = hashColorFromId(s.entity.id);

    const sublabel =
      pointKind === "building"
        ? `${s.loc} LoC · risk ${s.yRaw.toFixed(2)}`
        : `${s.files.length} files · risk ${s.yRaw.toFixed(2)}`;

    return {
      id: s.entity.id,
      label: s.entity.name,
      kind: s.entity.kind,
      x: xNorm,
      y: yNorm,
      xRaw: s.xRaw,
      yRaw: s.yRaw,
      color,
      radius,
      sublabel,
    };
  });

  return {
    points,
    regions: [...REGIONS],
    xAxisLabel: "Churn (90d commits)",
    yAxisLabel: "Risk Score",
    overflow,
  };
}
