import type { FileEdge, EdgeKind, EdgeLayer, EdgeSeverity, Rect } from "@quanta/canvas-engine";

// Zoom-adaptive edge bundling. At wide zooms the per-file edge list
// (9500+ in realistic monorepos) degenerates into visual noise —
// thousands of nearly-parallel beziers fighting for the same pixels.
// The bundle passes here collapse that list in two steps matched to
// the LOD policy:
//
//   city  LOD → `collapseParallelEdges` : merge same-(src,dst) pairs.
//                Typical reduction on the demo graph: 1.3×–2×. Preserves
//                exact file-to-file routing, just drops redundancy.
//
//   galaxy LOD → `bundleByFolder`        : collapse each edge's endpoints
//                to their parent folder (prefix-limited to 3 segments),
//                then merge same-(srcFolder,dstFolder) pairs. Typical
//                reduction: 5×–20×. This is where the fps budget is won.
//
// Both passes produce `BundledEdge` — a thin extension of FileEdge that
// keeps the original `from`/`to` fields (first-seen ids, so downstream
// anchor computation still works) plus a `bundleCount` + dominant
// layer/kind picked from the underlying edges. Renderer chooses stroke
// width from `log(1 + bundleCount)` so a 50-edge bundle is ~3.9× thicker
// than a single edge, not 50×.
//
// Pure functions — no IO, no state. The renderer owns the cache.

/**
 * Bundled edge — structurally compatible with FileEdge (same `id`,
 * `from`, `to`, `kind`, `layer`, `weight` fields) so the renderer can
 * treat a bundled slice and the raw edge array interchangeably in the
 * draw loop. Extra fields describe the aggregate.
 */
export interface BundledEdge {
  id: string;
  from: string;
  to: string;
  kind: EdgeKind;
  layer: EdgeLayer;
  weight: number;
  severity?: EdgeSeverity;
  confidence?: number;
  animated?: boolean;
  crossGraph?: boolean;
  fromLine?: number;
  toLine?: number;
  fromSymbol?: string;
  toSymbol?: string;
  evidenceId?: string;
  graphId?: string;
  /** Number of underlying FileEdges merged into this bundle. 1 = no merge. */
  bundleCount: number;
  /** Sum of underlying edge weights. Used for budget sorting at the
   *  renderer side if the galaxy cap still needs a tie-breaker. */
  weightSum: number;
}

/** Maximum path-prefix depth used by `bundleByFolder`. Deeper than this
 *  and the "folders" start approaching files again, nullifying the
 *  reduction. 3 segments (e.g. `src/features/canvas`) hits the sweet spot
 *  on a typical monorepo layout. */
const DEFAULT_FOLDER_DEPTH = 3;

/**
 * City-tier collapse — merge edges that share the same ordered (src, dst)
 * pair. We keep direction (src → dst ≠ dst → src), drop `kind` as a key
 * dimension (a single bundle can mix kinds; we pick the dominant one for
 * colour), and sum weights. Preserves the first edge's fine-grained
 * fromLine/toLine so line-anchored renders at this tier still land on
 * a real line instead of the rect centre.
 */
export function collapseParallelEdges(edges: readonly FileEdge[]): BundledEdge[] {
  const buckets = new Map<string, {
    first: FileEdge;
    weightSum: number;
    count: number;
    kindTally: Map<EdgeKind, number>;
    maxSeverityRank: number;
    maxSeverity: EdgeSeverity | undefined;
    anyAnimated: boolean;
    anyCrossGraph: boolean;
  }>();

  for (const edge of edges) {
    const key = `${edge.from}\u0001${edge.to}`;
    const existing = buckets.get(key);
    const sevRank = severityRank(edge.severity);
    if (!existing) {
      const kt = new Map<EdgeKind, number>();
      kt.set(edge.kind, 1);
      buckets.set(key, {
        first: edge,
        weightSum: edge.weight ?? 0,
        count: 1,
        kindTally: kt,
        maxSeverityRank: sevRank,
        maxSeverity: edge.severity,
        anyAnimated: edge.animated === true,
        anyCrossGraph: edge.crossGraph === true,
      });
    } else {
      existing.weightSum += edge.weight ?? 0;
      existing.count += 1;
      existing.kindTally.set(edge.kind, (existing.kindTally.get(edge.kind) ?? 0) + 1);
      if (sevRank > existing.maxSeverityRank) {
        existing.maxSeverityRank = sevRank;
        existing.maxSeverity = edge.severity;
      }
      if (edge.animated) existing.anyAnimated = true;
      if (edge.crossGraph) existing.anyCrossGraph = true;
    }
  }

  const out: BundledEdge[] = new Array(buckets.size);
  let i = 0;
  for (const b of buckets.values()) {
    const dominantKind = pickDominantKind(b.kindTally, b.first.kind);
    out[i++] = {
      id: b.count === 1 ? b.first.id : `bundle:${b.first.from}->${b.first.to}`,
      from: b.first.from,
      to: b.first.to,
      kind: dominantKind,
      layer: b.first.layer,
      weight: b.first.weight ?? 0,
      weightSum: b.weightSum,
      bundleCount: b.count,
      severity: b.maxSeverity,
      confidence: b.first.confidence,
      animated: b.anyAnimated,
      crossGraph: b.anyCrossGraph,
      fromLine: b.count === 1 ? b.first.fromLine : undefined,
      toLine: b.count === 1 ? b.first.toLine : undefined,
      fromSymbol: b.count === 1 ? b.first.fromSymbol : undefined,
      toSymbol: b.count === 1 ? b.first.toSymbol : undefined,
      evidenceId: b.count === 1 ? b.first.evidenceId : undefined,
      graphId: b.first.graphId,
    };
  }
  return out;
}

/**
 * Galaxy-tier bundling — map each edge endpoint to its enclosing folder
 * prefix (capped at `folderDepth` segments) and collapse edges whose
 * (srcFolder, dstFolder) pair matches. Same-folder edges collapse into a
 * single self-bundle per folder (rendered as a short self-loop by the
 * caller, or simply skipped — we keep it in the output with from===to so
 * the renderer decides).
 *
 * `folderCenters` is an output-writable map keyed by folder path holding
 * the averaged rect-centre. The renderer resolves bundle endpoints by
 * synthesising a virtual Rect around each folder centre before passing
 * the bundle into the existing anchor computation. Producing centres here
 * (rather than separately) keeps the caller from iterating files twice.
 */
export function bundleByFolder(
  edges: readonly FileEdge[],
  fileRects: Map<string, Rect>,
  folderDepth: number = DEFAULT_FOLDER_DEPTH,
): {
  bundles: BundledEdge[];
  folderCenters: Map<string, { x: number; y: number }>;
} {
  const fileFolder = new Map<string, string>();
  const folderAccum = new Map<string, { sx: number; sy: number; n: number }>();

  // Single pass over the rect map so both folder->center and fileId->folder
  // are produced without a second iteration.
  for (const [fileId, rect] of fileRects) {
    const folder = folderPrefix(fileId, folderDepth);
    fileFolder.set(fileId, folder);
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    const acc = folderAccum.get(folder);
    if (!acc) {
      folderAccum.set(folder, { sx: cx, sy: cy, n: 1 });
    } else {
      acc.sx += cx;
      acc.sy += cy;
      acc.n += 1;
    }
  }

  const folderCenters = new Map<string, { x: number; y: number }>();
  for (const [folder, acc] of folderAccum) {
    folderCenters.set(folder, { x: acc.sx / acc.n, y: acc.sy / acc.n });
  }

  const buckets = new Map<string, {
    firstEdge: FileEdge;
    fromFolder: string;
    toFolder: string;
    weightSum: number;
    count: number;
    kindTally: Map<EdgeKind, number>;
    maxSeverityRank: number;
    maxSeverity: EdgeSeverity | undefined;
    anyAnimated: boolean;
    anyCrossGraph: boolean;
  }>();

  for (const edge of edges) {
    const fromFolder = fileFolder.get(edge.from) ?? folderPrefix(edge.from, folderDepth);
    const toFolder = fileFolder.get(edge.to) ?? folderPrefix(edge.to, folderDepth);
    const key = `${fromFolder}\u0001${toFolder}`;
    const existing = buckets.get(key);
    const sevRank = severityRank(edge.severity);
    if (!existing) {
      const kt = new Map<EdgeKind, number>();
      kt.set(edge.kind, 1);
      buckets.set(key, {
        firstEdge: edge,
        fromFolder,
        toFolder,
        weightSum: edge.weight ?? 0,
        count: 1,
        kindTally: kt,
        maxSeverityRank: sevRank,
        maxSeverity: edge.severity,
        anyAnimated: edge.animated === true,
        anyCrossGraph: edge.crossGraph === true,
      });
    } else {
      existing.weightSum += edge.weight ?? 0;
      existing.count += 1;
      existing.kindTally.set(edge.kind, (existing.kindTally.get(edge.kind) ?? 0) + 1);
      if (sevRank > existing.maxSeverityRank) {
        existing.maxSeverityRank = sevRank;
        existing.maxSeverity = edge.severity;
      }
      if (edge.animated) existing.anyAnimated = true;
      if (edge.crossGraph) existing.anyCrossGraph = true;
    }
  }

  const bundles: BundledEdge[] = [];
  for (const b of buckets.values()) {
    // Self-folder bundles (intra-folder edges) contribute nothing at the
    // galaxy tier — the bundle would collapse to a zero-length stroke at
    // the folder centre. Drop them; the caller can still show density
    // through the folder frame colour if desired.
    if (b.fromFolder === b.toFolder) continue;
    const dominantKind = pickDominantKind(b.kindTally, b.firstEdge.kind);
    bundles.push({
      id: `folder-bundle:${b.fromFolder}->${b.toFolder}`,
      from: b.firstEdge.from,
      to: b.firstEdge.to,
      kind: dominantKind,
      layer: b.firstEdge.layer,
      weight: b.firstEdge.weight ?? 0,
      weightSum: b.weightSum,
      bundleCount: b.count,
      severity: b.maxSeverity,
      confidence: b.firstEdge.confidence,
      animated: false, // folder-tier bundles never animate — too coarse.
      crossGraph: b.anyCrossGraph,
      graphId: b.firstEdge.graphId,
    });
  }
  return { bundles, folderCenters };
}

/**
 * Prefix-limit a file id to a folder path of at most `depth` segments.
 * `src/features/canvas/foo.ts` @ depth=3 → `src/features/canvas`. Root
 * files (no slash) return `""` — callers treat that as the top folder.
 */
export function folderPrefix(fileId: string, depth: number): string {
  const lastSlash = fileId.lastIndexOf("/");
  if (lastSlash < 0) return "";
  const dir = fileId.slice(0, lastSlash);
  if (depth <= 0) return dir;
  const parts = dir.split("/");
  if (parts.length <= depth) return dir;
  return parts.slice(0, depth).join("/");
}

/**
 * Pick the most frequent kind from a tally, breaking ties
 * deterministically. Without a tie-break, the result depends on Map
 * insertion order — which depends on edge arrival order — which means
 * the same graph can bundle with different colours across frames when
 * the upstream reorders edges (filter toggles, snapshot swaps). We
 * resolve ties by kind-string alphabetical order. Alphabetical (not
 * severity) because dominant-kind is a *display* decision; severity is
 * tracked separately on the bundle via `maxSeverity`.
 */
export function pickDominantKind(tally: Map<EdgeKind, number>, fallback: EdgeKind): EdgeKind {
  let best: EdgeKind = fallback;
  let bestCount = -1;
  for (const [k, c] of tally) {
    if (c > bestCount) {
      best = k;
      bestCount = c;
    } else if (c === bestCount && k < best) {
      // Deterministic tie-break: lexicographically earlier kind wins.
      best = k;
    }
  }
  return best;
}

function severityRank(s: EdgeSeverity | undefined): number {
  switch (s) {
    case "critical": return 3;
    case "high": return 2;
    case "medium": return 1;
    case "low": return 0;
    default: return -1;
  }
}

/**
 * Stroke-width multiplier derived from bundle count. Log-scaled so a
 * 50-edge bundle reads as ~3.9× the single-edge width, keeping the
 * dynamic range visually sane. `count=1` → multiplier 1 (unchanged).
 */
export function bundleWidthMultiplier(bundleCount: number): number {
  if (bundleCount <= 1) return 1;
  // log(1+1)=0.693, so normalise so count=1 → 1 and scale grows log-ish.
  return 1 + Math.log(bundleCount) * 0.85;
}
