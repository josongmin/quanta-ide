import type { WorkspaceGraph, FileNode, FileEdge, FunctionBlock, ArchLayer, EdgeKind, ProofBundle, WitnessStep, GraphHistory, GraphSnapshot } from "@quanta/canvas-engine";
import { deriveEdgeLayer } from "@quanta/canvas-engine";

// ── Vite glob: all TS/TSX source files per package ────────────────────
// New files are picked up automatically — no manual list needed.
const CE_RAW = import.meta.glob(
  "../../../../../canvas-engine/src/**/*.{ts,tsx}",
  { eager: true, as: "raw" },
) as Record<string, string>;

const CP_RAW = import.meta.glob(
  "../../../../../canvas-pixi/src/**/*.{ts,tsx}",
  { eager: true, as: "raw" },
) as Record<string, string>;

const CW_RAW = import.meta.glob(
  "../../../../../canvas-worker/src/**/*.{ts,tsx}",
  { eager: true, as: "raw" },
) as Record<string, string>;

// workspace-canvas components / hooks / store (excludes data/ to avoid self-reference)
const WC_RAW = import.meta.glob(
  "../{components,hooks,store}/**/*.{ts,tsx}",
  { eager: true, as: "raw" },
) as Record<string, string>;

// ── Path helpers ──────────────────────────────────────────────────────

function toFileId(key: string): string {
  if (key.startsWith("../../../../../canvas-engine/src/"))
    return key.replace("../../../../../canvas-engine/src/", "canvas-engine/");
  if (key.startsWith("../../../../../canvas-pixi/src/"))
    return key.replace("../../../../../canvas-pixi/src/", "canvas-pixi/");
  if (key.startsWith("../../../../../canvas-worker/src/"))
    return key.replace("../../../../../canvas-worker/src/", "canvas-worker/");
  // "../components/X" → "workspace-canvas/components/X"
  return "workspace-canvas/" + key.slice("../".length);
}

function shouldInclude(key: string, src: string): boolean {
  if (key.includes("__tests__") || key.includes(".test.") || key.includes(".spec.")) return false;
  const file = key.split("/").pop() ?? "";
  if (file === "index.ts" || file === "index.tsx") return false;
  return src.split("\n").filter(l => l.trim()).length >= 5;
}

// ── Layer inference ───────────────────────────────────────────────────

function inferLayer(id: string): ArchLayer {
  if (id.startsWith("canvas-engine/")) return "domain";
  if (id.startsWith("canvas-pixi/"))   return "adapter";
  if (id.startsWith("canvas-worker/")) return "infra";
  if (id.includes("/components/"))     return "ui";
  if (id.includes("/hooks/"))          return "util";
  if (id.includes("/store/"))          return "infra";
  return "unknown";
}

// ── Risk score (derived from LOC, deterministic) ──────────────────────

function riskScore(src: string): number {
  const lines = src.split("\n").filter(l => l.trim()).length;
  return parseFloat(Math.min(0.88, 0.05 + lines / 280).toFixed(2));
}

// ── Function extraction ───────────────────────────────────────────────

const SKIP_FN = new Set(["if", "for", "while", "switch", "catch", "return", "new", "super"]);

function parseFunctions(src: string): FunctionBlock[] {
  const lines = src.split("\n");
  const out: FunctionBlock[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const m =
      l.match(/^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+(\w+)\s*[<(]/) ??
      l.match(/^\s*(?:export\s+)?const\s+(\w+)\s*(?::<[^>]+>)?\s*=\s*(?:async\s+)?\(/) ??
      l.match(/^  (?:(?:public|private|protected|static|async|override|abstract)\s+)*([a-z]\w*)\s*\(/);
    const name = m?.[1];
    if (!name || SKIP_FN.has(name) || seen.has(name)) continue;
    seen.add(name);
    out.push({ name, startLine: i + 1, endLine: Math.min(i + 40, lines.length), signalCount: 0, complexity: 1 });
  }
  return out;
}

// ── Edge extraction from import statements ─────────────────────────────

function resolveRelative(fromId: string, rel: string): string {
  const parts = [...fromId.split("/").slice(0, -1), ...rel.split("/")];
  const out: string[] = [];
  for (const p of parts) {
    if (p === "..") out.pop();
    else if (p !== ".") out.push(p);
  }
  return out.join("/");
}

function extractEdges(fileId: string, src: string, known: Set<string>): FileEdge[] {
  const edges: FileEdge[] = [];
  const seen = new Set<string>();
  const RE = /from\s+['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;

  while ((m = RE.exec(src)) !== null) {
    const spec = m[1];
    let target: string | null = null;

    if (spec.startsWith(".")) {
      const base = resolveRelative(fileId, spec);
      for (const ext of ["", ".ts", ".tsx"]) {
        if (known.has(base + ext)) { target = base + ext; break; }
      }
    } else if (spec.startsWith("@quanta/canvas-engine")) {
      // Route to the primary types file so inter-package edges are visible
      target = known.has("canvas-engine/graph/types.ts") ? "canvas-engine/graph/types.ts" : null;
    } else if (spec.startsWith("@quanta/canvas-pixi")) {
      target = known.has("canvas-pixi/stage/PixiStage.tsx") ? "canvas-pixi/stage/PixiStage.tsx" : null;
    }

    if (target && target !== fileId && !seen.has(target)) {
      seen.add(target);
      edges.push({
        id: `e:${fileId}→${target}`,
        from: fileId,
        to: target,
        kind: "import",
        layer: "structural",
        weight: 1,
      });
    }
  }
  return edges;
}

// ── Synthetic edge augmentation (demo variety) ────────────────────────
// The scanner above only emits `import` edges. For the demo we synthesize
// call / reference / dataflow / taint-propagation / blast / cycle / impact
// edges on top of the import graph so the new renderer has every EdgeLayer
// to show. The analyzer in production will replace all of this.

function mkEdge(
  from: string,
  to: string,
  kind: EdgeKind,
  extras: Omit<FileEdge, "id" | "from" | "to" | "kind" | "layer"> = { weight: 1 },
): FileEdge {
  return {
    id: `e:${kind}:${from}→${to}`,
    from,
    to,
    kind,
    layer: deriveEdgeLayer(kind),
    ...extras,
  };
}

// Deterministic indexing (prime offsets) keeps edge synthesis stable across
// dev-server reloads so fast-refresh doesn't flicker the graph.
function synthesizeEdges(files: FileNode[], imports: FileEdge[]): FileEdge[] {
  if (files.length === 0) return [];
  const N = files.length;
  const ids = files.map(f => f.id);
  const byId = new Map(files.map(f => [f.id, f]));
  const out: FileEdge[] = [];
  const seen = new Set<string>(imports.map(e => `${e.kind}:${e.from}→${e.to}`));
  const push = (e: FileEdge): void => {
    const k = `${e.kind}:${e.from}→${e.to}`;
    if (seen.has(k) || e.from === e.to) return;
    seen.add(k);
    out.push(e);
  };

  // Pick a deterministic function from a file given a stride index. Used to
  // give synthesized edges a believable line anchor — the street/ground
  // renderer lights up a dot at this line position on the card edge so the
  // reader sees exactly which symbol originates the relation.
  const pickFn = (fileId: string, stride: number) => {
    const f = byId.get(fileId);
    if (!f || f.functions.length === 0) return undefined;
    const fn = f.functions[stride % f.functions.length];
    return { line: fn.startLine, symbol: fn.name };
  };
  const withAnchors = (
    from: string, to: string, kind: EdgeKind, strideA: number, strideB: number,
    extras: Omit<FileEdge, "id" | "from" | "to" | "kind" | "layer" | "fromLine" | "fromSymbol" | "toLine" | "toSymbol">,
  ): FileEdge => {
    const a = pickFn(from, strideA);
    const b = pickFn(to, strideB);
    return mkEdge(from, to, kind, {
      ...extras,
      ...(a && { fromLine: a.line, fromSymbol: a.symbol }),
      ...(b && { toLine: b.line, toSymbol: b.symbol }),
    });
  };

  // Files that look function-heavy → good "call" sources. Files in adapter
  // or util layer → good "reference" sources. Deterministic pick-by-index.
  const fnHeavy = files.filter(f => f.functions.length >= 4).map(f => f.id);
  const utils   = files.filter(f => f.layer === "util" || f.layer === "adapter").map(f => f.id);

  // ── Structural: call edges (~0.4 * N) between function-heavy files ──
  const callCount = Math.max(2, Math.floor(N * 0.4));
  for (let i = 0; i < callCount && fnHeavy.length >= 2; i++) {
    const a = fnHeavy[i % fnHeavy.length];
    const b = fnHeavy[(i * 3 + 1) % fnHeavy.length];
    push(withAnchors(a, b, "call", i, i + 1, { weight: 1.1, confidence: 0.9 }));
  }

  // ── Structural: reference edges (~0.15 * N, lower weight) ──────────
  const refCount = Math.max(1, Math.floor(N * 0.15));
  for (let i = 0; i < refCount && ids.length >= 2; i++) {
    const a = ids[(i * 5) % N];
    const b = utils.length ? utils[i % utils.length] : ids[(i * 5 + 3) % N];
    push(withAnchors(a, b, "reference", i + 2, i + 5, { weight: 0.6, confidence: 0.75 }));
  }

  // ── Flow: dataflow edges (~0.15 * N) between adjacent packages ────
  const flowCount = Math.max(1, Math.floor(N * 0.15));
  for (let i = 0; i < flowCount && ids.length >= 2; i++) {
    const a = ids[(i * 7) % N];
    const b = ids[(i * 7 + 2) % N];
    push(withAnchors(a, b, "dataflow", i + 1, i + 4, { weight: 0.9, confidence: 0.7, animated: true }));
  }

  // ── Safety: taint-propagation (~0.05 * N, severity=high) ──────────
  const taintCount = Math.max(1, Math.ceil(N * 0.05));
  for (let i = 0; i < taintCount && ids.length >= 2; i++) {
    const a = ids[(i * 11) % N];
    const b = ids[(i * 11 + 5) % N];
    push(withAnchors(a, b, "taint-propagation", i, i + 2, {
      weight: 1.2,
      severity: "high",
      confidence: 0.85,
      animated: true,
      evidenceId: `proof:taint-${i}`,
    }));
  }

  // ── Safety: blast (severity=critical) — pick the highest-risk files ─
  const byRisk = [...files].sort((a, b) => b.riskScore - a.riskScore).slice(0, 4);
  for (let i = 0; i < byRisk.length - 1; i++) {
    push(withAnchors(byRisk[i].id, byRisk[i + 1].id, "blast", i, i + 3, {
      weight: 1.4,
      severity: "critical",
      confidence: 0.95,
      evidenceId: `proof:blast-${i}`,
    }));
  }

  // ── Safety: cycle edges — synthesize a 2-file cycle if possible ───
  for (let i = 0; i < Math.min(2, imports.length); i++) {
    const imp = imports[i];
    push(withAnchors(imp.to, imp.from, "cycle", i, i + 1, {
      weight: 1.0,
      severity: "medium",
      confidence: 0.8,
    }));
  }

  // ── Impact: 2-4 edges from the highest-risk file (simulated change) ─
  if (byRisk.length > 0) {
    const origin = byRisk[0].id;
    const impactTargets = ids.filter(id => id !== origin).slice(0, 3);
    for (let i = 0; i < impactTargets.length; i++) {
      push(withAnchors(origin, impactTargets[i], "impact", 0, i + 2, {
        weight: 1.0,
        severity: i === 0 ? "high" : "medium",
        confidence: 0.7,
        evidenceId: `proof:impact-${i}`,
      }));
    }
  }

  return out;
}

// ── Proof bundle synthesis ────────────────────────────────────────────
// Build one ProofBundle per FileEdge.evidenceId. Witness steps reference
// files that actually exist in the graph so the panel's "open step" hook
// can scroll the canvas to a real card. Per-kind step recipes pick plausible
// roles (source → propagation → sanitizer-bypass → sink for taint etc.).

interface StepSeed {
  role: WitnessStep["role"];
  description: string;
  snippet: string;
  symbol?: string;
}

const TAINT_SEEDS: StepSeed[] = [
  {
    role: "source",
    description: "user input arrives at raw request handler",
    snippet: "const q = request.query.get('q');\nreturn runSearch(q);",
    symbol: "handleSearch",
  },
  {
    role: "propagation",
    description: "string passed unchanged into query builder",
    snippet: "function runSearch(term: string) {\n  return orm.build(`SELECT * FROM items WHERE name LIKE '%${term}%'`);\n}",
    symbol: "runSearch",
  },
  {
    role: "sanitizer-bypass",
    description: "quote() skipped on LIKE operand (whitelist miss)",
    snippet: "// LIKE operand intentionally not escaped\nif (op !== 'LIKE') return quote(v);\nreturn v;",
    symbol: "maybeQuote",
  },
  {
    role: "sink",
    description: "SQL execution without parameter binding",
    snippet: "db.exec(sql); // NO params array",
    symbol: "exec",
  },
];

const BLAST_SEEDS: StepSeed[] = [
  {
    role: "source",
    description: "config module mutated during hot-reload",
    snippet: "export const CONFIG = Object.freeze(load());",
    symbol: "CONFIG",
  },
  {
    role: "flow",
    description: "consumer reads the singleton at request time",
    snippet: "function getLimits() {\n  return CONFIG.rate;\n}",
    symbol: "getLimits",
  },
  {
    role: "sink",
    description: "downstream service crashes on stale shape",
    snippet: "if (!limits.perUser) throw new Error('missing rate bound');",
    symbol: "validate",
  },
];

const IMPACT_SEEDS: StepSeed[] = [
  {
    role: "source",
    description: "public export signature changed in diff",
    snippet: "-export function render(scene: Scene): void\n+export function render(scene: Scene, opts: Options): void",
    symbol: "render",
  },
  {
    role: "propagation",
    description: "caller still passes old arity",
    snippet: "render(scene); // OPT arg missing after upgrade",
    symbol: "draw",
  },
  {
    role: "sink",
    description: "unit under review exercises the same path",
    snippet: "expect(render(scene)).toMatchSnapshot();",
    symbol: "render test",
  },
];

function pickFiles(ids: string[], from: string, to: string, count: number): string[] {
  const picks: string[] = [from];
  const pool = ids.filter(id => id !== from && id !== to);
  for (let i = 0; i < count - 2 && pool.length > 0; i++) {
    picks.push(pool[(i * 13 + 5) % pool.length]);
  }
  picks.push(to);
  return picks;
}

function synthesizeProofs(edges: FileEdge[], fileIds: string[]): Record<string, ProofBundle> {
  const proofs: Record<string, ProofBundle> = {};
  const ts = Date.UTC(2026, 3, 17);
  for (const edge of edges) {
    if (!edge.evidenceId) continue;

    let seeds: StepSeed[];
    let analyzer: string;
    let rule: string | undefined;
    let summary: string;
    let kind: ProofBundle["kind"];

    if (edge.kind === "taint-propagation") {
      seeds = TAINT_SEEDS;
      analyzer = "taint_flow";
      rule = "django.sql-injection";
      summary = `Untrusted input flows from ${edge.from.split("/").pop()} into a SQL sink without parameterization.`;
      kind = "taint-propagation";
    } else if (edge.kind === "blast") {
      seeds = BLAST_SEEDS;
      analyzer = "blast_radius";
      rule = "config.shared-mutable";
      summary = `Change in ${edge.from.split("/").pop()} propagates through a shared singleton to ${edge.to.split("/").pop()}.`;
      kind = "blast";
    } else if (edge.kind === "impact") {
      seeds = IMPACT_SEEDS;
      analyzer = "diff_impact";
      rule = "api.signature-break";
      summary = `Signature change in ${edge.from.split("/").pop()} breaks callers in ${edge.to.split("/").pop()}.`;
      kind = "impact";
    } else {
      continue;
    }

    const stepFiles = pickFiles(fileIds, edge.from, edge.to, seeds.length);
    const steps: WitnessStep[] = seeds.map((seed, i) => ({
      stepId: `${edge.evidenceId}:step-${i}`,
      file: stepFiles[i] ?? edge.to,
      line: 40 + i * 24,
      symbol: seed.symbol,
      role: seed.role,
      snippet: seed.snippet,
      description: seed.description,
    }));

    proofs[edge.evidenceId] = {
      id: edge.evidenceId,
      kind,
      severity: edge.severity ?? "medium",
      summary,
      steps,
      analyzer,
      rule,
      confidence: edge.confidence ?? 0.8,
      createdAt: ts,
    };
  }
  return proofs;
}

// ── Mock history (Stage 5: temporal slider + diff) ────────────────────
// Five snapshots over ~10 days. Baseline carries 60% of the eventual
// edge set; each later snapshot adds 10% and removes 5% of the *current*
// set. Indexed picks (no RNG) so dev-reload doesn't flicker the slider.

interface HistoryPlan {
  dayOffset: number;
  label: string;
}

const HISTORY_PLAN: readonly HistoryPlan[] = [
  { dayOffset: 0,  label: "day-0"  },
  { dayOffset: 2,  label: "day-2"  },
  { dayOffset: 5,  label: "day-5"  },
  { dayOffset: 7,  label: "day-7"  },
  { dayOffset: 10, label: "day-10" },
] as const;

function synthesizeHistory(edges: readonly FileEdge[]): GraphHistory | undefined {
  if (edges.length < 5) return undefined;
  const ids = edges.map(e => e.id);
  const N = ids.length;
  const baseCount = Math.max(1, Math.floor(N * 0.6));
  // Deterministic baseline: every (N/baseCount)-th edge starting at 0.
  const baseStride = Math.max(1, Math.floor(N / baseCount));
  const base = new Set<string>();
  for (let i = 0; i < N && base.size < baseCount; i += baseStride) base.add(ids[i]);
  // Top up if stride under-filled due to rounding.
  for (let i = 0; i < N && base.size < baseCount; i++) base.add(ids[i]);

  const now = Date.UTC(2026, 3, 17);
  const DAY_MS = 86_400_000;

  const snapshots: GraphSnapshot[] = [];
  const current = new Set<string>(base);
  snapshots.push({
    timestamp: now - HISTORY_PLAN[HISTORY_PLAN.length - 1].dayOffset * DAY_MS,
    label: HISTORY_PLAN[0].label,
    edgeIds: [...current],
  });

  for (let s = 1; s < HISTORY_PLAN.length; s++) {
    const plan = HISTORY_PLAN[s];
    const addCount = Math.max(1, Math.floor(current.size * 0.10));
    const removeCount = Math.max(1, Math.floor(current.size * 0.05));

    // Candidates for add = edges NOT currently present, picked with a
    // prime-strided offset so successive snapshots don't rediscover the
    // same set.
    const missing: string[] = [];
    for (const id of ids) if (!current.has(id)) missing.push(id);
    const added: string[] = [];
    for (let i = 0; i < addCount && missing.length > 0; i++) {
      const pick = missing[(i * 11 + s * 7) % missing.length];
      if (!current.has(pick) && !added.includes(pick)) added.push(pick);
    }

    // Candidates for removal: take edges that existed in the baseline
    // before this snapshot — stride by a different prime to avoid
    // always-removing the oldest entries.
    const present = [...current];
    const removed: string[] = [];
    for (let i = 0; i < removeCount && present.length > 0; i++) {
      const pick = present[(i * 13 + s * 5) % present.length];
      if (current.has(pick) && !removed.includes(pick) && !added.includes(pick)) {
        removed.push(pick);
      }
    }

    for (const id of added) current.add(id);
    for (const id of removed) current.delete(id);

    snapshots.push({
      timestamp: now - (HISTORY_PLAN[HISTORY_PLAN.length - 1].dayOffset - plan.dayOffset) * DAY_MS,
      label: plan.label,
      added,
      removed,
    });
  }

  return { snapshots, baseIndex: 0 };
}

// ── Build ─────────────────────────────────────────────────────────────

function build(): { graph: WorkspaceGraph; sources: Record<string, string> } {
  const allRaw: Record<string, string> = { ...CE_RAW, ...CP_RAW, ...CW_RAW, ...WC_RAW };
  const sources: Record<string, string> = {};
  const files: FileNode[] = [];

  for (const [key, src] of Object.entries(allRaw)) {
    if (!shouldInclude(key, src)) continue;
    const id = toFileId(key);
    sources[id] = src;
    files.push({
      id,
      name: id.split("/").pop() ?? id,
      layer: inferLayer(id),
      riskScore: riskScore(src),
      loc: src.split("\n").filter(l => l.trim()).length,
      signals: { taintCount: 0, blastCritical: 0, deadCount: 0, archViolations: 0, cpxMax: 1 },
      functions: parseFunctions(src),
    });
  }

  const known = new Set(files.map(f => f.id));
  const imports: FileEdge[] = files.flatMap(f => extractEdges(f.id, sources[f.id] ?? "", known));
  const synthetic = synthesizeEdges(files, imports);
  const fileEdges: FileEdge[] = [...imports, ...synthetic];
  const proofs = synthesizeProofs(fileEdges, files.map(f => f.id));
  const history = synthesizeHistory(fileEdges);

  return { graph: { files, fileEdges, comments: [], proofs, history }, sources };
}

const { graph, sources } = build();

export const SAMPLE_GRAPH: WorkspaceGraph = graph;
export const SAMPLE_SOURCES: Record<string, string> = sources;
