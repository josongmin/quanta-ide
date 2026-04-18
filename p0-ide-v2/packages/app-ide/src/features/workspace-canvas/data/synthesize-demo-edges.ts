import type { FileEdge, FileNode, EdgeKind, EdgeSeverity } from "@quanta/canvas-engine";
import { deriveEdgeLayer } from "@quanta/canvas-engine";

// Demo-only edge synthesis on top of whatever the repo-scanner produces.
// The real scanner only emits `import` edges, so every other kind (call,
// taint, blast, feature-flag, supply-chain, …) would never render. This
// helper fakes the full catalog using a hash-seeded pseudo-random pairing
// so the HUD's kind toggles have something to filter. Deterministic per
// (file-id-set, kind) so the graph is stable across hot-reloads.

const ALL_DEMO_KINDS: readonly EdgeKind[] = [
  "call", "reference", "cfg", "inheritance", "test-covers", "clone",
  "dataflow", "effect", "pdg", "alias", "feature-flag",
  "taint-propagation", "sanitizer", "race", "cycle", "finding",
  "contract", "dead-edge", "runtime-divergence",
  "blast", "impact", "diff", "dependency", "witness",
  "cochange", "rename-pair", "supply-chain",
];

// FNV-1a 32-bit. Cheap, good enough for demo seeding.
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

// LCG seeded by `seed` — same seed = same stream. Small state, tiny footprint.
function makeRng(seed: number): () => number {
  let s = (seed || 1) >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

// Density per kind, expressed as a fraction of |files|. Hand-tuned so the
// structural + flow kinds stay dense enough to read as "the shape of the
// code" while safety/impact stay sparse enough to pop. Numbers are not
// meant to be realistic — they just give every toggle something visible.
const DENSITY: Record<EdgeKind, number> = {
  import: 0,  // already from scanner
  call: 0.35, reference: 0.2, cfg: 0.15, inheritance: 0.08,
  "test-covers": 0.12, clone: 0.05,
  dataflow: 0.2, effect: 0.1, pdg: 0.08, alias: 0.06,
  "feature-flag": 0.06,
  "taint-propagation": 0.06, sanitizer: 0.04, race: 0.03,
  cycle: 0.03, finding: 0.04,
  contract: 0.04, "dead-edge": 0.04, "runtime-divergence": 0.02,
  blast: 0.04, impact: 0.05, diff: 0.06, dependency: 0.08, witness: 0.03,
  cochange: 0.1, "rename-pair": 0.03, "supply-chain": 0.02,
};

const SEVERITY_BY_KIND: Partial<Record<EdgeKind, EdgeSeverity>> = {
  "taint-propagation": "high", sanitizer: "medium", race: "high",
  cycle: "medium", finding: "high",
  contract: "high", "dead-edge": "low", "runtime-divergence": "critical",
  blast: "critical", impact: "high", witness: "high",
  "supply-chain": "critical",
};

const ANIMATED_KINDS: ReadonlySet<EdgeKind> = new Set([
  "dataflow", "taint-propagation", "runtime-divergence",
]);

function pickFnAnchor(file: FileNode | undefined, stride: number) {
  if (!file || file.functions.length === 0) return undefined;
  const fn = file.functions[stride % file.functions.length];
  return { line: fn.startLine, symbol: fn.name };
}

/**
 * Add demo edges of every non-import kind on top of the scanner's output.
 * Mutates neither `files` nor `existing`; returns a new edge list
 * containing both the passed-in imports and the synthesized kinds.
 */
export function synthesizeDemoEdges(
  files: readonly FileNode[],
  existing: readonly FileEdge[],
): FileEdge[] {
  if (files.length < 2) return [...existing];
  const out: FileEdge[] = [...existing];
  const seen = new Set<string>(existing.map(e => `${e.kind}:${e.from}→${e.to}`));
  const byId = new Map(files.map(f => [f.id, f]));
  const ids = files.map(f => f.id);

  const idSetSeed = hash(ids.join("|"));

  for (const kind of ALL_DEMO_KINDS) {
    const density = DENSITY[kind] ?? 0;
    const n = Math.max(1, Math.round(ids.length * density));
    const rng = makeRng(idSetSeed ^ hash(kind));
    let made = 0;
    let tries = 0;
    const maxTries = n * 8;
    while (made < n && tries < maxTries) {
      tries += 1;
      const a = ids[Math.floor(rng() * ids.length)];
      const b = ids[Math.floor(rng() * ids.length)];
      if (a === b) continue;
      const key = `${kind}:${a}→${b}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const fromFile = byId.get(a);
      const toFile = byId.get(b);
      const strideA = Math.floor(rng() * 8);
      const strideB = Math.floor(rng() * 8);
      const anchorA = pickFnAnchor(fromFile, strideA);
      const anchorB = pickFnAnchor(toFile, strideB);
      const severity = SEVERITY_BY_KIND[kind];
      const animated = ANIMATED_KINDS.has(kind);
      out.push({
        id: `e:demo:${kind}:${a}→${b}`,
        from: a,
        to: b,
        kind,
        layer: deriveEdgeLayer(kind),
        weight: 0.6 + rng() * 0.8,
        confidence: 0.55 + rng() * 0.4,
        ...(severity && { severity }),
        ...(animated && { animated: true }),
        ...(anchorA && { fromLine: anchorA.line, fromSymbol: anchorA.symbol }),
        ...(anchorB && { toLine: anchorB.line, toSymbol: anchorB.symbol }),
      });
      made += 1;
    }
  }

  return out;
}
