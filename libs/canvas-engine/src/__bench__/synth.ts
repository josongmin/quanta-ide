import type {
  WorkspaceGraph,
  FileNode,
  FileEdge,
  EdgeKind,
  ArchLayer,
} from "../graph/types";
import type { FileBlame, BlameEntry } from "../graph/blame";

// Deterministic PRNG so bench runs are reproducible across invocations — a
// Mulberry32 (same flavour the metrics module uses). Avoids Math.random so a
// regression doesn't hide behind run-to-run variance.
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SynthOptions {
  files: number;
  /** Mean edges emitted per file (count is per-file ~Poisson-ish via rng). */
  edgesPerFile?: number;
  /** Fraction of files that get blame entries (0..1). Default 0.25. */
  blameFraction?: number;
  /** How many synthetic cycles to plant. Default: max(1, files/500). */
  cycles?: number;
  /** PRNG seed — keep stable so numbers are comparable across runs. */
  seed?: number;
}

const LAYERS: ArchLayer[] = ["domain", "adapter", "infra", "ui", "util", "unknown"];
const EDGE_KINDS: EdgeKind[] = [
  "import",
  "call",
  "reference",
  "dataflow",
  "cycle",
  "taint-propagation",
  "blast",
];

const DAY = 86_400_000;

/**
 * Build a synthetic {@link WorkspaceGraph} shaped like a real repo at scale:
 *
 *   - Directory tree is skewed (files cluster in a handful of top-level dirs)
 *     so the treemap layout path hits realistic group counts.
 *   - Function blocks per file follow a long-tail (1..12), so the city LOD
 *     costs scale the way production does.
 *   - Edges are mostly intra-directory with a few cross-cutting links, plus
 *     planted cycles so SCC / ROI cycle component have signal.
 *   - ~25% of files get blame entries, with committedAt spread over the last
 *     ~180 days so churn normalization has variance.
 *
 * Total cost is O(files + edges); 5k files / ~15k edges builds in < 50ms on
 * dev hardware so it doesn't dominate benchmark setup time.
 */
export function buildSynthGraph(opts: SynthOptions): WorkspaceGraph {
  const fileCount = opts.files;
  const edgesPerFile = opts.edgesPerFile ?? 3;
  const blameFraction = opts.blameFraction ?? 0.25;
  const cycleCount = opts.cycles ?? Math.max(1, Math.floor(fileCount / 500));
  const rng = makeRng(opts.seed ?? 0x1234);

  // ── directory skeleton ─────────────────────────────────────────────
  // Pick ~sqrt(files) top-level buckets, each with a handful of subdirs.
  // Produces path shapes like "pkg07/feature03/file_0421.ts" that mimic a
  // real monorepo's fanout.
  const topDirs = Math.max(4, Math.floor(Math.sqrt(fileCount)));
  const files: FileNode[] = [];
  for (let i = 0; i < fileCount; i++) {
    const top = Math.floor(rng() * topDirs);
    const sub = Math.floor(rng() * 6);
    const id = `pkg${String(top).padStart(3, "0")}/sub${sub}/file_${String(i).padStart(5, "0")}.ts`;
    const loc = 20 + Math.floor(rng() * 800);
    const cpxMax = Math.floor(rng() * 25);
    const functionCount = 1 + Math.floor(rng() * 12);
    const functions = Array.from({ length: functionCount }, (_, k) => ({
      name: `fn_${k}`,
      startLine: k * 8 + 1,
      endLine: k * 8 + 7,
      signalCount: Math.floor(rng() * 3),
      complexity: Math.floor(rng() * 15),
    }));
    files.push({
      id,
      name: id.split("/").pop() ?? id,
      layer: LAYERS[Math.floor(rng() * LAYERS.length)],
      riskScore: rng(),
      loc,
      signals: {
        taintCount: Math.floor(rng() * 4),
        blastCritical: Math.floor(rng() * 3),
        deadCount: Math.floor(rng() * 2),
        archViolations: Math.floor(rng() * 2),
        cpxMax,
      },
      functions,
    });
  }

  // ── edges ──────────────────────────────────────────────────────────
  // Most edges are forward (i → j where j > i) so the base graph is mostly
  // acyclic, then we plant explicit cycles on top.
  const fileEdges: FileEdge[] = [];
  let edgeId = 0;
  for (let i = 0; i < fileCount; i++) {
    // Per-file count: rough Poisson via Math.floor(rng() * 2 * mean + 1).
    const k = Math.min(edgesPerFile * 2, 1 + Math.floor(rng() * edgesPerFile * 2));
    for (let e = 0; e < k; e++) {
      // 80% intra-cluster (nearby index), 20% long-range — matches realistic
      // import density where tight coupling dominates but a few edges cross
      // the repo (shared utils, types, entrypoints).
      const local = rng() < 0.8;
      let j: number;
      if (local) {
        const stride = 1 + Math.floor(rng() * 15);
        j = Math.min(fileCount - 1, i + stride);
      } else {
        j = Math.floor(rng() * fileCount);
      }
      if (j === i) continue;
      const kind = EDGE_KINDS[Math.floor(rng() * EDGE_KINDS.length)];
      fileEdges.push({
        id: `e${edgeId++}`,
        from: files[i].id,
        to: files[j].id,
        kind,
        layer:
          kind === "taint-propagation" || kind === "cycle"
            ? "safety"
            : kind === "blast"
              ? "impact"
              : kind === "dataflow"
                ? "flow"
                : "structural",
        weight: 1 + Math.floor(rng() * 5),
        confidence: 0.5 + rng() * 0.5,
      });
    }
  }

  // ── planted cycles ────────────────────────────────────────────────
  // Each cycle is a small ring (3..6 nodes) so SCC finds non-trivial
  // components and ROI's cycleMembership has something to normalize.
  for (let c = 0; c < cycleCount; c++) {
    const size = 3 + Math.floor(rng() * 4);
    const start = Math.floor(rng() * (fileCount - size));
    for (let s = 0; s < size; s++) {
      const from = files[start + s].id;
      const to = files[start + ((s + 1) % size)].id;
      fileEdges.push({
        id: `cycle_${c}_${s}`,
        from,
        to,
        kind: "cycle",
        layer: "safety",
        weight: 1,
      });
    }
  }

  // ── blame sample ───────────────────────────────────────────────────
  // A fraction of files get blame entries with committedAt spread over the
  // last ~180 days — half fresh, half older — so ROI's churn axis has a
  // realistic mix instead of everyone scoring 0 or 100.
  const blame: Record<string, FileBlame> = {};
  const now = Date.now();
  const blameCount = Math.floor(fileCount * blameFraction);
  for (let b = 0; b < blameCount; b++) {
    const f = files[Math.floor(rng() * fileCount)];
    if (blame[f.id]) continue;
    const entries: BlameEntry[] = [];
    const chunkCount = 1 + Math.floor(rng() * 4);
    let line = 1;
    for (let i = 0; i < chunkCount; i++) {
      const len = 1 + Math.floor(rng() * 20);
      const ageDays = Math.floor(rng() * 180);
      entries.push({
        startLine: line,
        endLine: line + len - 1,
        committedAt: now - ageDays * DAY,
        author: `dev${Math.floor(rng() * 12)}`,
      });
      line += len;
    }
    blame[f.id] = {
      fileId: f.id,
      entries,
      lineCount: Math.max(line, f.loc),
    };
  }

  return {
    files,
    fileEdges,
    comments: [],
    blame,
  };
}
