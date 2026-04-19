import type { WorkspaceGraph, FileNode, FileEdge, FunctionBlock, ArchLayer, EdgeKind, EffectKind, FileEffects, FileLatency, ProofBundle, WitnessStep, GraphHistory, GraphSnapshot, FileBlame, BlameEntry, NamedGraph, JoinEdge, Trace, TraceSpan, TraceEdge, TracePack, WorkspaceComment } from "@quanta/canvas-engine";
import { deriveEdgeLayer, joinGraphs } from "@quanta/canvas-engine";

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
      l.match(/^ {2}(?:(?:public|private|protected|static|async|override|abstract)\s+)*([a-z]\w*)\s*\(/);
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
// The scanner above only emits `import` edges. Each additional EdgeKind
// has its own distinct criterion so a reader can tell, just from *where*
// edges appear, which relation is being drawn. See the per-kind rules
// below. The analyzer in production will replace all of this.

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

// BFS reachability with max hop bound.
function reachableWithin(
  adj: Map<string, string[]>, start: string, maxHops: number,
): Set<string> {
  const seen = new Set<string>();
  const frontier: Array<[string, number]> = [[start, 0]];
  while (frontier.length > 0) {
    const [n, d] = frontier.shift()!;
    if (d >= maxHops) continue;
    for (const next of adj.get(n) ?? []) {
      if (seen.has(next) || next === start) continue;
      seen.add(next);
      frontier.push([next, d + 1]);
    }
  }
  return seen;
}

// Tarjan's SCC. Iterative to avoid stack-overflow on wide graphs.
function tarjanSccs(nodes: string[], adj: Map<string, string[]>): string[][] {
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const sccs: string[][] = [];
  let counter = 0;

  for (const root of nodes) {
    if (index.has(root)) continue;
    // Iterative emulation of the recursive strongConnect.
    const work: Array<{ v: string; it: Iterator<string> }> = [];
    index.set(root, counter);
    low.set(root, counter);
    counter++;
    stack.push(root);
    onStack.add(root);
    work.push({ v: root, it: (adj.get(root) ?? [])[Symbol.iterator]() });

    while (work.length > 0) {
      const top = work[work.length - 1];
      const next = top.it.next();
      if (next.done) {
        if (low.get(top.v) === index.get(top.v)) {
          const scc: string[] = [];
          while (true) {
            const w = stack.pop()!;
            onStack.delete(w);
            scc.push(w);
            if (w === top.v) break;
          }
          sccs.push(scc);
        }
        work.pop();
        if (work.length > 0) {
          const parent = work[work.length - 1].v;
          low.set(parent, Math.min(low.get(parent)!, low.get(top.v)!));
        }
        continue;
      }
      const w = next.value;
      if (!index.has(w)) {
        index.set(w, counter);
        low.set(w, counter);
        counter++;
        stack.push(w);
        onStack.add(w);
        work.push({ v: w, it: (adj.get(w) ?? [])[Symbol.iterator]() });
      } else if (onStack.has(w)) {
        low.set(top.v, Math.min(low.get(top.v)!, index.get(w)!));
      }
    }
  }
  return sccs;
}

/**
 * Derive per-kind edges with distinct criteria so the reader can *see* what
 * each line type means:
 *
 *   import             — real `from "..."` resolution (in extractEdges)
 *   call               — A imports B AND A's source invokes one of B's exported
 *                        function names as a call site (`name(` syntax)
 *   reference          — the N most-imported "hub" files → each of their
 *                        dependents (util-like fan-in pattern)
 *   dataflow           — 2-hop transitive closure of the import graph that
 *                        isn't already a direct import (A→B→C emits A→C)
 *   taint-propagation  — files with io/net effects → files reachable within
 *                        ≤2 import hops that have db/env effects (source→sink)
 *   blast              — top-3 highest-risk files → their direct dependents
 *                        (what breaks when the risky file changes)
 *   cycle              — real SCCs of size ≥ 2 in the import graph
 *   impact             — file with the most functions → its direct dependents
 *                        (signature change fan-out)
 */
function synthesizeEdges(
  files: FileNode[],
  imports: FileEdge[],
  sources: Record<string, string>,
): FileEdge[] {
  if (files.length === 0) return [];
  const byId = new Map(files.map(f => [f.id, f]));
  const out: FileEdge[] = [];
  const seen = new Set<string>(imports.map(e => `${e.kind}:${e.from}→${e.to}`));
  const push = (e: FileEdge): void => {
    const k = `${e.kind}:${e.from}→${e.to}`;
    if (seen.has(k) || e.from === e.to) return;
    seen.add(k);
    out.push(e);
  };

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

  // ── Adjacency from the real import graph ──────────────────────────
  const fwd = new Map<string, string[]>(); // from → [to]
  const rev = new Map<string, string[]>(); // to   → [from]
  for (const e of imports) {
    const f = fwd.get(e.from); if (f) f.push(e.to); else fwd.set(e.from, [e.to]);
    const r = rev.get(e.to);   if (r) r.push(e.from); else rev.set(e.to, [e.from]);
  }
  const importPair = new Set(imports.map(e => `${e.from}→${e.to}`));

  // ── call: A imports B AND A's source invokes a B-exported function ──
  // Exact line from the regex hit so the street-tier glow dot lands at
  // the call site, not a generic "first function" fallback.
  for (const e of imports) {
    const target = byId.get(e.to);
    const src = sources[e.from];
    if (!target || !src || target.functions.length === 0) continue;
    let hit: { line: number; name: string; toLine: number } | null = null;
    for (const fn of target.functions) {
      const re = new RegExp(`\\b${fn.name}\\s*\\(`);
      const m = re.exec(src);
      if (m && m.index !== undefined) {
        const line = src.slice(0, m.index).split("\n").length;
        hit = { line, name: fn.name, toLine: fn.startLine };
        break;
      }
    }
    if (!hit) continue;
    push(mkEdge(e.from, e.to, "call", {
      weight: 1.1, confidence: 0.9,
      fromLine: hit.line, fromSymbol: hit.name,
      toLine: hit.toLine, toSymbol: hit.name,
    }));
  }

  // ── reference: top-3 most-imported "hub" files → their dependents ──
  // These look like util / core-types files. Reference edges fan *into*
  // the hub from many dependents, distinct from call's one-to-one shape.
  const hubs = [...rev.entries()]
    .filter(([, consumers]) => consumers.length >= 2)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 3)
    .map(([id]) => id);
  for (const hub of hubs) {
    const consumers = rev.get(hub) ?? [];
    for (let i = 0; i < consumers.length; i++) {
      push(withAnchors(consumers[i], hub, "reference", i, i + 1, {
        weight: 0.6, confidence: 0.75,
      }));
    }
  }

  // ── dataflow: 2-hop transitive closure, excluding direct imports ───
  // Capped so a dense graph doesn't drown the canvas in N² lines.
  const DATAFLOW_CAP = 30;
  let flowCount = 0;
  outer: for (const [a, mids] of fwd) {
    for (const mid of mids) {
      const cs = fwd.get(mid);
      if (!cs) continue;
      for (const c of cs) {
        if (c === a) continue;
        if (importPair.has(`${a}→${c}`)) continue;
        push(withAnchors(a, c, "dataflow", 0, 3, {
          weight: 0.9, confidence: 0.7, animated: true,
        }));
        flowCount++;
        if (flowCount >= DATAFLOW_CAP) break outer;
      }
    }
  }

  // ── taint-propagation: io/net source → db/env sink within ≤2 hops ──
  // Effects are inferred from file id (see inferEffectsForId). This makes
  // taint edges appear along real import paths out of I/O boundaries and
  // into storage/config — the shape a real taint analyzer would draw.
  const isSource = (id: string): boolean => {
    const e = inferEffectsForId(id);
    return e.includes("io") || e.includes("net");
  };
  const isSink = (id: string): boolean => {
    const e = inferEffectsForId(id);
    return e.includes("db") || e.includes("env");
  };
  const TAINT_CAP = 10;
  let taintIdx = 0;
  taintLoop: for (const f of files) {
    if (!isSource(f.id)) continue;
    const reach = reachableWithin(fwd, f.id, 2);
    for (const r of reach) {
      if (!isSink(r)) continue;
      push(withAnchors(f.id, r, "taint-propagation", taintIdx, taintIdx + 2, {
        weight: 1.2, severity: "high", confidence: 0.85, animated: true,
        evidenceId: `proof:taint-${taintIdx}`,
      }));
      taintIdx++;
      if (taintIdx >= TAINT_CAP) break taintLoop;
    }
  }

  // ── blast: top-3 risk files → their direct dependents (rev-imports) ─
  const byRisk = [...files].sort((a, b) => b.riskScore - a.riskScore).slice(0, 3);
  let blastIdx = 0;
  for (const epicenter of byRisk) {
    const deps = rev.get(epicenter.id) ?? [];
    for (let i = 0; i < Math.min(deps.length, 4); i++) {
      push(withAnchors(epicenter.id, deps[i], "blast", 0, i + 1, {
        weight: 1.4,
        severity: blastIdx === 0 ? "critical" : "high",
        confidence: 0.95,
        evidenceId: `proof:blast-${blastIdx}`,
      }));
      blastIdx++;
    }
  }

  // ── cycle: real SCCs of size ≥ 2 in the import graph ──────────────
  const CYCLE_CAP = 6;
  const sccs = tarjanSccs(files.map(f => f.id), fwd);
  let cycleIdx = 0;
  sccLoop: for (const scc of sccs) {
    if (scc.length < 2) continue;
    for (let i = 0; i < scc.length; i++) {
      const a = scc[i];
      const b = scc[(i + 1) % scc.length];
      push(withAnchors(a, b, "cycle", cycleIdx, cycleIdx + 1, {
        weight: 1.0, severity: "medium", confidence: 0.8,
      }));
      cycleIdx++;
      if (cycleIdx >= CYCLE_CAP) break sccLoop;
    }
  }

  // ── impact: file with most functions → its direct dependents ──────
  const hotFile = [...files].sort((a, b) => b.functions.length - a.functions.length)[0];
  if (hotFile) {
    const deps = rev.get(hotFile.id) ?? [];
    for (let i = 0; i < Math.min(deps.length, 4); i++) {
      push(withAnchors(hotFile.id, deps[i], "impact", 0, i + 2, {
        weight: 1.0,
        severity: i === 0 ? "high" : "medium",
        confidence: 0.7,
        evidenceId: `proof:impact-${i}`,
      }));
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // Extended synthesis: 20 additional kinds covering the full analyzer
  // taxonomy. Each has its own criterion so the reader can tell edges
  // apart by *where they appear* — not just by colour.
  // ════════════════════════════════════════════════════════════════════

  // Extract every exported identifier from a source file — functions,
  // classes, consts, type aliases, interfaces. Used by dead-edge, alias,
  // contract, inheritance and clone detectors.
  const extractExportNames = (src: string): string[] => {
    const names = new Set<string>();
    const patterns: RegExp[] = [
      /export\s+(?:async\s+)?function\s+(\w+)/g,
      /export\s+(?:abstract\s+)?class\s+(\w+)/g,
      /export\s+const\s+(\w+)/g,
      /export\s+let\s+(\w+)/g,
      /export\s+type\s+(\w+)/g,
      /export\s+interface\s+(\w+)/g,
      /export\s+enum\s+(\w+)/g,
    ];
    for (const re of patterns) {
      let m: RegExpExecArray | null;
      while ((m = re.exec(src)) !== null) names.add(m[1]);
    }
    return [...names];
  };

  const exportMap = new Map<string, string[]>();
  for (const f of files) exportMap.set(f.id, extractExportNames(sources[f.id] ?? ""));
  const exportOwner = new Map<string, string>(); // symbol → first file that exports it
  for (const [id, syms] of exportMap) {
    for (const s of syms) if (!exportOwner.has(s)) exportOwner.set(s, id);
  }

  // ── inheritance: `class X extends Y` / `implements Y` resolved via exports
  const classRe = /class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([\w,\s]+))?/g;
  const INHERIT_CAP = 12;
  let inheritCount = 0;
  inheritLoop: for (const f of files) {
    const src = sources[f.id];
    if (!src) continue;
    let m: RegExpExecArray | null;
    while ((m = classRe.exec(src)) !== null) {
      const parent = m[2];
      const interfaces = (m[3] ?? "").split(",").map(s => s.trim()).filter(Boolean);
      const targets = [parent, ...interfaces].filter((x): x is string => !!x);
      for (const t of targets) {
        const owner = exportOwner.get(t);
        if (!owner || owner === f.id) continue;
        push(mkEdge(f.id, owner, "inheritance", {
          weight: 1.0, confidence: 0.95, fromSymbol: m[1], toSymbol: t,
        }));
        inheritCount++;
        if (inheritCount >= INHERIT_CAP) break inheritLoop;
      }
    }
  }

  // ── test-covers: strong shared prefix (≥6 chars) name pairing
  // Proxy for "test → SUT" when no real test files exist. A file whose
  // basename is a strict extension of another's is treated as covering it.
  const TEST_COVERS_CAP = 6;
  let testCoversCount = 0;
  const basenames = files.map(f => ({ f, base: (f.name.replace(/\.[^.]+$/, "") || f.name).toLowerCase() }));
  testLoop: for (let i = 0; i < basenames.length; i++) {
    for (let j = 0; j < basenames.length; j++) {
      if (i === j) continue;
      const a = basenames[i], b = basenames[j];
      if (a.base.length < 6 || b.base.length < 6) continue;
      if (a.base.startsWith(b.base) && a.base !== b.base) {
        push(withAnchors(a.f.id, b.f.id, "test-covers", 0, 0, {
          weight: 0.7, confidence: 0.7,
        }));
        testCoversCount++;
        if (testCoversCount >= TEST_COVERS_CAP) break testLoop;
      }
    }
  }

  // ── clone: high Jaccard similarity on function-name sets (≥0.6, size ≥3)
  const fnSets = new Map<string, Set<string>>();
  for (const f of files) fnSets.set(f.id, new Set(f.functions.map(fn => fn.name)));
  const CLONE_CAP = 6;
  let cloneCount = 0;
  cloneLoop: for (let i = 0; i < files.length; i++) {
    const a = files[i], sa = fnSets.get(a.id)!;
    if (sa.size < 3) continue;
    for (let j = i + 1; j < files.length; j++) {
      const b = files[j], sb = fnSets.get(b.id)!;
      if (sb.size < 3) continue;
      let inter = 0;
      for (const n of sa) if (sb.has(n)) inter++;
      const union = sa.size + sb.size - inter;
      const jac = union === 0 ? 0 : inter / union;
      if (jac >= 0.6) {
        push(withAnchors(a.id, b.id, "clone", 0, 0, {
          weight: 0.8, confidence: jac, severity: jac >= 0.85 ? "high" : "medium",
        }));
        cloneCount++;
        if (cloneCount >= CLONE_CAP) break cloneLoop;
      }
    }
  }

  // ── effect: two files sharing the same non-pure effect kind (env/io/db)
  // This is the "shared side-channel" relation — e.g., both touch the
  // same store, or both write env variables. Pairs within the same
  // package to avoid unrelated noise.
  const EFFECT_CAP = 10;
  const effectOf = new Map(files.map(f => [f.id, inferEffectsForId(f.id)]));
  const sharedEffects = ["env", "db", "net"] as const;
  let effectCount = 0;
  effLoop: for (let i = 0; i < files.length; i++) {
    for (let j = i + 1; j < files.length; j++) {
      const a = files[i], b = files[j];
      const pkgA = a.id.split("/")[0], pkgB = b.id.split("/")[0];
      if (pkgA !== pkgB) continue;
      const ea = effectOf.get(a.id)!, eb = effectOf.get(b.id)!;
      const shared = sharedEffects.filter(k => ea.includes(k) && eb.includes(k));
      if (shared.length === 0) continue;
      push(withAnchors(a.id, b.id, "effect", 0, 0, {
        weight: 0.7, confidence: 0.7,
      }));
      effectCount++;
      if (effectCount >= EFFECT_CAP) break effLoop;
    }
  }

  // ── pdg: edges that are BOTH a call (direct import+use) and 2-hop data
  // This is the intersection — "control AND data flow both reach here".
  const PDG_CAP = 8;
  const dataflowPairs = new Set<string>();
  for (const e of out) if (e.kind === "dataflow") dataflowPairs.add(`${e.from}→${e.to}`);
  const callPairs = new Set<string>();
  for (const e of out) if (e.kind === "call") callPairs.add(`${e.from}→${e.to}`);
  let pdgCount = 0;
  for (const e of imports) {
    if (pdgCount >= PDG_CAP) break;
    if (callPairs.has(`${e.from}→${e.to}`) && dataflowPairs.has(`${e.from}→${e.to}`)) {
      push(withAnchors(e.from, e.to, "pdg", 0, 0, { weight: 0.8, confidence: 0.7 }));
      pdgCount++;
    }
  }

  // ── alias: two files that export the same identifier name (name collision
  // → points-to aliasing when either is imported under the same symbol)
  const symToFiles = new Map<string, string[]>();
  for (const [fid, syms] of exportMap) {
    for (const s of syms) {
      const arr = symToFiles.get(s);
      if (arr) arr.push(fid); else symToFiles.set(s, [fid]);
    }
  }
  const ALIAS_CAP = 6;
  let aliasCount = 0;
  aliasLoop: for (const [sym, fids] of symToFiles) {
    if (fids.length < 2 || sym.length < 4) continue;
    for (let i = 0; i < fids.length - 1; i++) {
      push(mkEdge(fids[i], fids[i + 1], "alias", {
        weight: 0.5, confidence: 0.6, fromSymbol: sym, toSymbol: sym,
      }));
      aliasCount++;
      if (aliasCount >= ALIAS_CAP) break aliasLoop;
    }
  }

  // ── feature-flag: files whose id/name contains config/flag/feature →
  // their direct importers (the gated code paths).
  const flagRe = /(config|flag|feature|toggle)/i;
  const FLAG_CAP = 8;
  let flagCount = 0;
  flagLoop: for (const f of files) {
    if (!flagRe.test(f.id)) continue;
    const gated = rev.get(f.id) ?? [];
    for (const g of gated) {
      push(withAnchors(f.id, g, "feature-flag", 0, 0, {
        weight: 0.8, confidence: 0.75, animated: true,
      }));
      flagCount++;
      if (flagCount >= FLAG_CAP) break flagLoop;
    }
  }

  // ── sanitizer: for a few taint sources, identify an intermediate file
  // whose id/name implies sanitization and emit a sanitizer barrier edge
  // from that intermediate into each downstream sink.
  const sanitizerRe = /(sanitiz|validat|guard|escape|normalize)/i;
  const sanitizers = files.filter(f => sanitizerRe.test(f.id)).map(f => f.id);
  const SANITIZER_CAP = 5;
  let sanCount = 0;
  if (sanitizers.length > 0) {
    for (const e of out.filter(x => x.kind === "taint-propagation")) {
      if (sanCount >= SANITIZER_CAP) break;
      const mid = sanitizers[sanCount % sanitizers.length];
      if (mid === e.from || mid === e.to) continue;
      push(withAnchors(mid, e.to, "sanitizer", 0, 0, {
        weight: 1.0, confidence: 0.9, severity: "low",
      }));
      sanCount++;
    }
  }

  // ── race: pairs of infra/adapter files both carrying io+env effects
  // (concurrent writers to the same side-channel).
  const RACE_CAP = 4;
  const racyLayers: ArchLayer[] = ["infra", "adapter"];
  const racyFiles = files.filter(f => {
    const e = effectOf.get(f.id) ?? [];
    return racyLayers.includes(f.layer) && e.includes("io") && e.includes("env");
  });
  let raceCount = 0;
  raceLoop: for (let i = 0; i < racyFiles.length; i++) {
    for (let j = i + 1; j < racyFiles.length; j++) {
      push(withAnchors(racyFiles[i].id, racyFiles[j].id, "race", 0, 0, {
        weight: 0.9, confidence: 0.65, severity: "high",
      }));
      raceCount++;
      if (raceCount >= RACE_CAP) break raceLoop;
    }
  }

  // ── finding: lint-rule-like hits on function-complexity peaks. Pair up
  // consecutive hotspots as "same rule fired in both locations".
  const FINDING_CAP = 5;
  const cpxPeaks = [...files]
    .filter(f => f.functions.length >= 5)
    .sort((a, b) => b.functions.length - a.functions.length)
    .slice(0, FINDING_CAP + 1);
  for (let i = 0; i < cpxPeaks.length - 1; i++) {
    push(withAnchors(cpxPeaks[i].id, cpxPeaks[i + 1].id, "finding", 0, 0, {
      weight: 1.0, confidence: 0.85, severity: i === 0 ? "high" : "medium",
      evidenceId: `proof:finding-${i}`,
    }));
  }

  // ── contract: types / .d.ts / interface hub file → its importers
  // (spec ↔ implementation coupling)
  const contractRe = /(types?\.ts|\.d\.ts|contract|schema)/i;
  const CONTRACT_CAP = 8;
  let contractCount = 0;
  contractLoop: for (const f of files) {
    if (!contractRe.test(f.id)) continue;
    const consumers = rev.get(f.id) ?? [];
    for (const c of consumers) {
      push(withAnchors(f.id, c, "contract", 0, 0, {
        weight: 0.7, confidence: 0.8,
      }));
      contractCount++;
      if (contractCount >= CONTRACT_CAP) break contractLoop;
    }
  }

  // ── dead-edge: imports where the source file references NO exported
  // symbol of the target. True "unused import" detection.
  const DEAD_CAP = 8;
  let deadCount = 0;
  deadLoop: for (const e of imports) {
    const src = sources[e.from];
    const tgtExports = exportMap.get(e.to) ?? [];
    if (!src || tgtExports.length === 0) continue;
    const uses = tgtExports.some(n => {
      const re = new RegExp(`\\b${n}\\b`);
      return re.test(src);
    });
    if (uses) continue;
    push(mkEdge(e.from, e.to, "dead-edge", {
      weight: 0.4, confidence: 0.75, severity: "low",
    }));
    deadCount++;
    if (deadCount >= DEAD_CAP) break deadLoop;
  }

  // ── runtime-divergence: edges that would be observed at runtime but
  // have no static counterpart. Proxy: pick two high-risk files and emit
  // a divergent edge between them that is NOT in the import graph.
  const DIVERGENCE_CAP = 3;
  const divergenceCandidates = byRisk.slice(0, 6);
  let divCount = 0;
  divLoop: for (let i = 0; i < divergenceCandidates.length; i++) {
    for (let j = 0; j < divergenceCandidates.length; j++) {
      if (i === j) continue;
      const a = divergenceCandidates[i].id, b = divergenceCandidates[j].id;
      if (importPair.has(`${a}→${b}`)) continue;
      push(withAnchors(a, b, "runtime-divergence", 0, 0, {
        weight: 1.1, confidence: 0.7, severity: "high", animated: true,
      }));
      divCount++;
      if (divCount >= DIVERGENCE_CAP) break divLoop;
    }
  }

  // ── diff: deterministic subset of import edges flagged as "changed in
  // most recent snapshot". Stable across reloads via hash(edge.id).
  const DIFF_CAP = 10;
  let diffCount = 0;
  for (const e of imports) {
    if (diffCount >= DIFF_CAP) break;
    if ((hashString(e.id) & 0b1111) !== 0) continue;
    push(mkEdge(e.from, e.to, "diff", {
      weight: 0.8, confidence: 0.8, severity: "medium",
      fromLine: e.fromLine, toLine: e.toLine,
    }));
    diffCount++;
  }

  // ── dependency: collapsed package-level edges. One edge per unique
  // cross-package pair, anchored at the lexicographically-first file of
  // each package so every package dep lands on the same endpoint.
  const pkgRep = new Map<string, string>();
  for (const f of [...files].sort((a, b) => a.id.localeCompare(b.id))) {
    const pkg = f.id.split("/")[0];
    if (!pkgRep.has(pkg)) pkgRep.set(pkg, f.id);
  }
  const pkgPairsSeen = new Set<string>();
  for (const e of imports) {
    const pa = e.from.split("/")[0];
    const pb = e.to.split("/")[0];
    if (pa === pb) continue;
    const k = `${pa}→${pb}`;
    if (pkgPairsSeen.has(k)) continue;
    pkgPairsSeen.add(k);
    const a = pkgRep.get(pa); const b = pkgRep.get(pb);
    if (!a || !b) continue;
    push(mkEdge(a, b, "dependency", { weight: 1.0, confidence: 0.95 }));
  }

  // ── witness: chain files through each evidenced edge's proof steps so
  // the renderer can draw the proof path as real edges (not just a panel
  // list). Uses the same id-prefixing convention as synthesizeProofs.
  const WITNESS_CAP = 12;
  let witnessCount = 0;
  const evidenced = out.filter(e => e.evidenceId);
  witLoop: for (const e of evidenced) {
    // Walk a 2-step path: from → (intermediate via rev) → to. The middle
    // file is the bridge witness — pick the rev/fwd neighbour that best
    // links source to sink.
    const midCandidates = [...(fwd.get(e.from) ?? []), ...(rev.get(e.to) ?? [])];
    const mid = midCandidates.find(m => m !== e.from && m !== e.to);
    if (!mid) continue;
    push(withAnchors(e.from, mid, "witness", 0, 0, {
      weight: 0.8, confidence: 0.85, evidenceId: e.evidenceId,
    }));
    push(withAnchors(mid, e.to, "witness", 0, 0, {
      weight: 0.8, confidence: 0.85, evidenceId: e.evidenceId,
    }));
    witnessCount += 2;
    if (witnessCount >= WITNESS_CAP) break witLoop;
  }

  // ── cochange: files that "always change together" — proxy by pairing
  // files within the same package whose function-count + loc bucket
  // collides. Stable across reloads via deterministic hash buckets.
  const COCHANGE_CAP = 10;
  const buckets = new Map<string, string[]>();
  for (const f of files) {
    const pkg = f.id.split("/")[0];
    const loBucket = Math.floor(f.loc / 40);
    const fnBucket = Math.floor(f.functions.length / 2);
    const k = `${pkg}|${loBucket}|${fnBucket}`;
    const arr = buckets.get(k);
    if (arr) arr.push(f.id); else buckets.set(k, [f.id]);
  }
  let cochangeCount = 0;
  cochangeLoop: for (const [, ids] of buckets) {
    if (ids.length < 2) continue;
    for (let i = 0; i < ids.length - 1; i++) {
      push(withAnchors(ids[i], ids[i + 1], "cochange", 0, 0, {
        weight: 0.5, confidence: 0.6,
      }));
      cochangeCount++;
      if (cochangeCount >= COCHANGE_CAP) break cochangeLoop;
    }
  }

  // ── rename-pair: two files whose basenames share ≥8-char common prefix
  // AND whose suffix differs only by a version/variant marker.
  // Proxy for "A was renamed from B" when git rename detection is absent.
  const RENAME_CAP = 3;
  let renameCount = 0;
  renameLoop: for (let i = 0; i < basenames.length; i++) {
    for (let j = i + 1; j < basenames.length; j++) {
      const a = basenames[i], b = basenames[j];
      let common = 0;
      while (common < Math.min(a.base.length, b.base.length) && a.base[common] === b.base[common]) common++;
      if (common < 8 || a.base === b.base) continue;
      const diffA = a.base.slice(common), diffB = b.base.slice(common);
      if (!/^[-_v\d]{0,6}$/.test(diffA) || !/^[-_v\d]{0,6}$/.test(diffB)) continue;
      push(withAnchors(a.f.id, b.f.id, "rename-pair", 0, 0, {
        weight: 0.6, confidence: 0.6,
      }));
      renameCount++;
      if (renameCount >= RENAME_CAP) break renameLoop;
    }
  }

  // ── supply-chain: one designated "vulnerable upstream" file → every
  // file that imports it. Demo stand-in for CVE propagation through deps.
  const supplyTarget =
    files.find(f => f.id.startsWith("canvas-worker/") && f.functions.length >= 2)?.id
    ?? files.find(f => f.layer === "infra")?.id;
  if (supplyTarget) {
    const consumers = rev.get(supplyTarget) ?? [];
    for (let i = 0; i < Math.min(consumers.length, 5); i++) {
      push(withAnchors(supplyTarget, consumers[i], "supply-chain", 0, 0, {
        weight: 1.2,
        confidence: 0.9,
        severity: i === 0 ? "critical" : "high",
        evidenceId: `proof:supply-${i}`,
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

// ── Blame synthesis (Stage 6: line-age overlay) ───────────────────────
// Per-file, bucket lines into 3–5 age ranges driven by function offsets.
// Deterministic prime-index hash on (fileId, rangeIndex) keeps the demo
// stable across dev-reloads so the gutter doesn't flicker.

const BLAME_AUTHORS = ["alice", "bob", "charlie", "dana"] as const;
const BLAME_MESSAGES = [
  "refactor: extract helpers",
  "fix: edge case on empty input",
  "feat: support new signal type",
  "chore: rename for clarity",
  "refactor: inline one-shot",
  "fix: off-by-one in loop",
  "feat: add overlay toggle",
  "chore: tighten types",
] as const;

const BLAME_DAY = 86_400_000;
const BLAME_AGE_BUCKETS: readonly number[] = [
  1   * BLAME_DAY,
  7   * BLAME_DAY,
  30  * BLAME_DAY,
  180 * BLAME_DAY,
  365 * BLAME_DAY,
  2 * 365 * BLAME_DAY,
];

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function synthesizeBlame(files: readonly FileNode[], now: number): Record<string, FileBlame> {
  const out: Record<string, FileBlame> = {};
  for (const f of files) {
    if (f.functions.length < 1 || f.loc < 2) continue;

    const cuts = new Set<number>([1, f.loc + 1]);
    for (const fn of f.functions) cuts.add(Math.max(1, Math.min(f.loc, fn.startLine)));
    const sorted = [...cuts].sort((a, b) => a - b);
    const clamped = sorted.length > 6 ? sorted.slice(0, 6) : sorted;

    const entries: BlameEntry[] = [];
    for (let i = 0; i < clamped.length - 1; i++) {
      const start = clamped[i];
      const end = Math.max(start, clamped[i + 1] - 1);
      const h = hashString(`${f.id}:${i}`);
      const bucket = BLAME_AGE_BUCKETS[h % BLAME_AGE_BUCKETS.length];
      const jitter = (h >>> 3) % BLAME_DAY;
      entries.push({
        startLine: start,
        endLine: end,
        committedAt: now - bucket - jitter,
        author: BLAME_AUTHORS[(h >>> 5) % BLAME_AUTHORS.length],
        commitSha: (h >>> 0).toString(16).padStart(8, "0"),
        message: BLAME_MESSAGES[(h >>> 7) % BLAME_MESSAGES.length],
      });
    }
    if (entries.length === 0) continue;
    out[f.id] = { fileId: f.id, entries, lineCount: f.loc };
  }
  return out;
}

// ── Effect synthesis (Stage 7: per-file side-effect badges) ───────────
// Deterministic mapping from file id → EffectKind[]. Real analyzer would
// walk the AST and observe side-effectful calls; the mock picks plausible
// sets per package so the UI has a varied demo.
//
// Rules:
//   - canvas-worker/*   → io + net  (it's the data tier + worker-bridge)
//   - canvas-engine/graph/* → pure   (pure data transforms)
//   - canvas-pixi/*      → io (GPU writes count as I/O)
//   - workspace-canvas/store/* → env + io (store = stateful)
//   - workspace-canvas/hooks/* → io
//   - UI components → pure-ish, no chips
//
// A deterministic hash on (fileId) decides whether to sprinkle db/crypto
// onto adapter-ish files so the chip palette is visibly varied.

function inferEffectsForId(id: string): EffectKind[] {
  const out: EffectKind[] = [];
  const push = (k: EffectKind): void => {
    if (!out.includes(k)) out.push(k);
  };

  if (id.startsWith("canvas-worker/")) {
    push("io");
    push("net");
  } else if (id.startsWith("canvas-engine/graph/")) {
    push("pure");
  } else if (id.startsWith("canvas-pixi/")) {
    push("io");
  } else if (id.includes("/store/")) {
    push("env");
    push("io");
  } else if (id.includes("/hooks/")) {
    push("io");
  }

  // Variety layer: prime-strided hash so two dev-reloads produce the same
  // extras (fnv1a already elsewhere — reuse the same approach).
  const h = hashString(id);
  if ((h & 0b111) === 0) push("db");       // ~12.5% of files
  if (((h >>> 3) & 0b1111) === 0) push("crypto"); // ~6%
  if (((h >>> 7) & 0b11111) === 0) push("random"); // ~3%
  if (((h >>> 11) & 0b11111) === 0) push("time");  // ~3%
  if (((h >>> 13) & 0b111111) === 0) push("fs");   // ~1.5%

  return out;
}

function synthesizeEffects(files: readonly FileNode[]): Record<string, FileEffects> {
  const out: Record<string, FileEffects> = {};
  for (const f of files) {
    const effects = inferEffectsForId(f.id);
    if (effects.length === 0) continue;
    const total = f.functions.length;
    const pure = effects.length === 1 && effects[0] === "pure" ? total : 0;
    out[f.id] = {
      fileId: f.id,
      effects,
      totalFunctions: total,
      pureFunctions: pure,
    };
  }
  return out;
}

// ── Latency synthesis (Stage 7: p50/p95/p99 per file) ─────────────────
// Most files read ~5ms p95 (fast). A handful of "hot" files (highest risk
// score) get >200ms, chosen deterministically so the demo top-N list is
// stable across reloads.

function synthesizeLatency(files: readonly FileNode[]): Record<string, FileLatency> {
  if (files.length === 0) return {};
  const out: Record<string, FileLatency> = {};
  // Deterministic index picks: the top-5 risk files become the hot set,
  // each spaced across the ramp so a reader sees a smooth "5ms → 800ms"
  // gradient in the HUD list.
  const ranked = [...files].sort((a, b) => b.riskScore - a.riskScore);
  const hotTargets = [800, 450, 260, 180, 120];
  const hotIds = new Set<string>();
  for (let i = 0; i < Math.min(hotTargets.length, ranked.length); i++) {
    hotIds.add(ranked[i].id);
  }

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const h = hashString(f.id);
    const hotIdx = ranked.findIndex(r => r.id === f.id);
    let p95: number;
    if (hotIds.has(f.id) && hotIdx >= 0 && hotIdx < hotTargets.length) {
      p95 = hotTargets[hotIdx];
    } else {
      // 3..12ms baseline with tiny hash-driven jitter.
      p95 = 3 + ((h >>> 2) % 10);
    }
    const p50 = Math.max(1, Math.floor(p95 * 0.45));
    const p99 = Math.floor(p95 * 1.35);
    const callCount = 10 + ((h >>> 5) % 240);
    out[f.id] = { fileId: f.id, p50, p95, p99, callCount };
  }
  return out;
}

// ── Review-comment synthesis (Stage 8: review-thread demo) ────────────
// Reviewers leave line-anchored notes so the collab / review UI has
// something to render. Recipe: pick a spread across packages + risk tiers,
// seed 1-3 comments per chosen file at function boundaries, and vary
// author / body / age / resolved-state via deterministic hashes. Without
// this the "review" and "collab.comments" features display empty panels
// even though the rest of the graph is fully populated.

// Seven author personas — enough variety that a reader scanning the
// thread sees several distinct voices rather than the same name twice.
const COMMENT_AUTHORS = [...BLAME_AUTHORS, "erin", "frank", "grace"] as const;

interface CommentSeed {
  role: "question" | "todo" | "nit" | "praise" | "bug" | "discussion";
  body: string;
}

// Each seed evokes a different review-note mode so the panel doesn't
// look like one reviewer's voice cloned six times.
const COMMENT_SEEDS: readonly CommentSeed[] = [
  { role: "question",   body: "왜 여기서 early-return 안 하고 아래까지 내려가요? 의도가 있는 거면 주석 한 줄 부탁." },
  { role: "todo",       body: "TODO: retry 정책 빠져있음. 다음 PR에서 붙이겠습니다." },
  { role: "nit",        body: "nit — 이름이 `handle`이 더 관례적일 듯. 기존 호출처들이 모두 그 패턴이에요." },
  { role: "praise",     body: "👏 이 리팩토링 깔끔합니다. 이전엔 여기가 회색지대였는데 훨씬 읽기 편해졌어요." },
  { role: "bug",        body: "이 path에서 null guard 없는 것 같은데요? 인시던트 #412 재현 케이스랑 겹칩니다." },
  { role: "discussion", body: "이거 domain에서 처리하는 게 맞을까요? infra에 가깝다는 느낌도 있어요. 팀 컨벤션 확인 필요." },
  { role: "question",   body: "capacity 기본값이 왜 4096인지 근거가 궁금합니다. 실측?" },
  { role: "todo",       body: "TODO: 이 분기 커버하는 테스트 추가 — 현재 coverage 맵에서 비어있음." },
  { role: "nit",        body: "nit — const 하나 추출해서 이름 붙여주면 가독성이 확 올라갈 듯." },
  { role: "bug",        body: "off-by-one 의심. 경계 조건에서 len vs len-1 다시 확인해봐주세요." },
  { role: "discussion", body: "여기 side-effect가 숨어있는 거 같은데, pure 표시 유지해도 되나요?" },
  { role: "praise",     body: "좋은 네이밍. `derive*` prefix 컨벤션 맞게 들어왔네요." },
];

function synthesizeComments(files: readonly FileNode[], nowTs: number): WorkspaceComment[] {
  if (files.length === 0) return [];
  const DAY_MS = 86_400_000;
  const out: WorkspaceComment[] = [];

  // Selection strategy: include the top-10 risk files (reviewers cluster
  // on risky code) plus an every-7th cross-section of the remainder so
  // we cover low-risk and boilerplate too. This yields ~N/7+10 commented
  // files — ~40-60 comments for a mid-size graph.
  const ranked = [...files].sort((a, b) => b.riskScore - a.riskScore);
  const chosen = new Set<string>();
  for (let i = 0; i < Math.min(10, ranked.length); i++) chosen.add(ranked[i].id);
  for (let i = 0; i < files.length; i += 7) chosen.add(files[i].id);

  let seq = 0;
  for (const f of files) {
    if (!chosen.has(f.id)) continue;
    const h0 = hashString(`${f.id}:cmt`);
    // 1..3 threads per file, weighted toward 2 so most files have a pair.
    const threadCount = 1 + ((h0 >>> 2) % 3);
    for (let i = 0; i < threadCount; i++) {
      const h = hashString(`${f.id}:cmt:${i}`);
      const seed = COMMENT_SEEDS[h % COMMENT_SEEDS.length];
      const author = COMMENT_AUTHORS[(h >>> 4) % COMMENT_AUTHORS.length];
      // Anchor to a function start when available so the line-gutter
      // marker lands on something meaningful; fall back to an early line.
      const anchor = f.functions.length > 0
        ? f.functions[(h >>> 9) % f.functions.length].startLine
        : Math.max(1, (h >>> 12) % Math.max(1, f.loc));
      // Age: 0..60 days, with 40% within the last week so the demo
      // feels "active" rather than a ghost town of ancient comments.
      const ageDays = ((h >>> 16) % 60);
      const committedAt = nowTs - ageDays * DAY_MS - (((h >>> 22) & 0xfff) * 60_000);
      // 30% resolved — enough that the "resolved filter" toggle has
      // something to hide; 70% unresolved so the default view is busy.
      const resolved = ((h >>> 28) & 0b111) < 2;
      out.push({
        id: `cmt:${f.id}:${i}:${seq++}`,
        fileId: f.id,
        line: anchor,
        author,
        body: seed.body,
        resolved,
        createdAt: committedAt,
      });
    }
  }
  return out;
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
  const synthetic = synthesizeEdges(files, imports, sources);
  const fileEdges: FileEdge[] = [...imports, ...synthetic];
  const nowTs = Date.UTC(2026, 3, 17);
  const proofs = synthesizeProofs(fileEdges, files.map(f => f.id));
  const history = synthesizeHistory(fileEdges);
  const blame = synthesizeBlame(files, nowTs);
  const effects = synthesizeEffects(files);
  const latency = synthesizeLatency(files);
  const comments = synthesizeComments(files, nowTs);

  return { graph: { files, fileEdges, comments, proofs, history, blame, effects, latency }, sources };
}

const { graph: mainGraph, sources: mainSources } = build();

// ── Auth-service mock graph (Stage 6: multi-graph join) ───────────────
// A small microservice alongside the main graph. Joined via 2-3 api-call
// edges from the highest-risk main files into the service's public
// entry points so the "cross-service reference" demo has a visible path.

interface AuthFileSpec {
  id: string;
  layer: ArchLayer;
  loc: number;
  riskScore: number;
  functions: Array<{ name: string; startLine: number; signalCount?: number; complexity?: number }>;
}

const AUTH_FILES: AuthFileSpec[] = [
  { id: "auth-service/src/routes/login.ts", layer: "ui", loc: 120, riskScore: 0.55,
    functions: [{ name: "loginHandler", startLine: 15, complexity: 6 }, { name: "validateBody", startLine: 58, complexity: 3 }] },
  { id: "auth-service/src/routes/refresh.ts", layer: "ui", loc: 90, riskScore: 0.48,
    functions: [{ name: "refreshHandler", startLine: 10, complexity: 4 }] },
  { id: "auth-service/src/routes/session.ts", layer: "ui", loc: 110, riskScore: 0.52,
    functions: [{ name: "sessionInfo", startLine: 12, complexity: 3 }, { name: "revokeSession", startLine: 60, complexity: 4 }] },
  { id: "auth-service/src/domain/tokens.ts", layer: "domain", loc: 180, riskScore: 0.7,
    functions: [{ name: "signToken", startLine: 20, complexity: 5 }, { name: "verifyToken", startLine: 80, complexity: 7 }] },
  { id: "auth-service/src/domain/password.ts", layer: "domain", loc: 140, riskScore: 0.66,
    functions: [{ name: "hashPassword", startLine: 14, complexity: 4 }, { name: "comparePassword", startLine: 55, complexity: 5 }] },
  { id: "auth-service/src/domain/policy.ts", layer: "domain", loc: 95, riskScore: 0.4,
    functions: [{ name: "checkPolicy", startLine: 18, complexity: 6 }] },
  { id: "auth-service/src/adapters/user-repo.ts", layer: "adapter", loc: 160, riskScore: 0.58,
    functions: [{ name: "findByEmail", startLine: 22, complexity: 4 }, { name: "createUser", startLine: 80, complexity: 5 }] },
  { id: "auth-service/src/adapters/redis-store.ts", layer: "adapter", loc: 130, riskScore: 0.45,
    functions: [{ name: "put", startLine: 18, complexity: 3 }, { name: "get", startLine: 50, complexity: 3 }] },
  { id: "auth-service/src/infra/crypto.ts", layer: "infra", loc: 75, riskScore: 0.35,
    functions: [{ name: "randomBytes", startLine: 8, complexity: 2 }] },
  { id: "auth-service/src/infra/logger.ts", layer: "infra", loc: 60, riskScore: 0.2,
    functions: [{ name: "log", startLine: 10, complexity: 2 }] },
];

function buildAuthGraph(): WorkspaceGraph {
  const files: FileNode[] = AUTH_FILES.map(spec => {
    const fnBlocks: FunctionBlock[] = spec.functions.map(fn => ({
      name: fn.name,
      startLine: fn.startLine,
      endLine: Math.min(spec.loc, fn.startLine + 24),
      signalCount: fn.signalCount ?? 0,
      complexity: fn.complexity ?? 2,
    }));
    return {
      id: spec.id,
      name: spec.id.split("/").pop() ?? spec.id,
      layer: spec.layer,
      riskScore: spec.riskScore,
      loc: spec.loc,
      signals: { taintCount: 0, blastCritical: 0, deadCount: 0, archViolations: 0, cpxMax: 1 },
      functions: fnBlocks,
    };
  });

  const edges: FileEdge[] = [];
  const addEdge = (from: string, to: string, kind: EdgeKind, extras: Partial<FileEdge> = {}): void => {
    edges.push({
      id: `e:auth:${kind}:${from}→${to}`,
      from, to, kind,
      layer: deriveEdgeLayer(kind),
      weight: extras.weight ?? 1,
      confidence: extras.confidence,
      severity: extras.severity,
      animated: extras.animated,
    });
  };

  addEdge("auth-service/src/routes/login.ts",   "auth-service/src/domain/password.ts", "call", { weight: 1.1, confidence: 0.9 });
  addEdge("auth-service/src/routes/login.ts",   "auth-service/src/domain/tokens.ts",   "call", { weight: 1.1, confidence: 0.9 });
  addEdge("auth-service/src/routes/login.ts",   "auth-service/src/adapters/user-repo.ts", "call", { weight: 1.0, confidence: 0.85 });
  addEdge("auth-service/src/routes/refresh.ts", "auth-service/src/domain/tokens.ts",   "call", { weight: 1.0, confidence: 0.9 });
  addEdge("auth-service/src/routes/refresh.ts", "auth-service/src/adapters/redis-store.ts", "call", { weight: 0.9, confidence: 0.8 });
  addEdge("auth-service/src/routes/session.ts", "auth-service/src/domain/policy.ts",   "call", { weight: 1.0, confidence: 0.85 });
  addEdge("auth-service/src/routes/session.ts", "auth-service/src/adapters/redis-store.ts", "call", { weight: 0.9, confidence: 0.85 });
  addEdge("auth-service/src/domain/tokens.ts",  "auth-service/src/infra/crypto.ts",    "call", { weight: 0.8, confidence: 0.9 });
  addEdge("auth-service/src/domain/password.ts","auth-service/src/infra/crypto.ts",    "call", { weight: 0.8, confidence: 0.9 });
  addEdge("auth-service/src/adapters/user-repo.ts", "auth-service/src/infra/logger.ts", "reference", { weight: 0.5, confidence: 0.7 });
  addEdge("auth-service/src/domain/tokens.ts",  "auth-service/src/domain/password.ts", "dataflow", { weight: 0.8, confidence: 0.75, animated: true });
  addEdge("auth-service/src/routes/login.ts",   "auth-service/src/domain/tokens.ts",   "taint-propagation", {
    weight: 1.2, severity: "high", confidence: 0.8, animated: true,
  });

  // Auth-service comments mirror the main-graph synthesizer (same seed
  // pool + deterministic hashes) so the joined view shows a single,
  // coherent review conversation spanning both services.
  const comments = synthesizeComments(files, Date.UTC(2026, 3, 17));

  return { files, fileEdges: edges, comments };
}

const AUTH_GRAPH: WorkspaceGraph = buildAuthGraph();

const MAIN_GRAPH_ID = "main";
const AUTH_GRAPH_ID = "auth";

function buildJoinEdges(): JoinEdge[] {
  const riskRanked = [...mainGraph.files].sort((a, b) => b.riskScore - a.riskScore);
  const topMainFiles = riskRanked.slice(0, 3).map(f => f.id);
  const entries = [
    "auth-service/src/routes/login.ts",
    "auth-service/src/routes/session.ts",
    "auth-service/src/routes/refresh.ts",
  ];
  const joins: JoinEdge[] = [];
  for (let i = 0; i < Math.min(3, topMainFiles.length); i++) {
    joins.push({
      fromGraphId: MAIN_GRAPH_ID,
      fromFileId: topMainFiles[i],
      toGraphId: AUTH_GRAPH_ID,
      toFileId: entries[i % entries.length],
      kind: "api-call",
      severity: i === 0 ? "high" : "medium",
      confidence: 0.8,
      weight: 1.1,
    });
  }
  return joins;
}

const NAMED_MAIN: NamedGraph = {
  graphId: MAIN_GRAPH_ID,
  label: "main",
  color: 0x3b82f6,
  graph: mainGraph,
};
const NAMED_AUTH: NamedGraph = {
  graphId: AUTH_GRAPH_ID,
  label: "auth",
  color: 0xf59e0b,
  graph: AUTH_GRAPH,
};

const JOIN_EDGES: JoinEdge[] = buildJoinEdges();

const JOINED = joinGraphs([NAMED_MAIN, NAMED_AUTH], JOIN_EDGES);

// Carry across the main graph's history + blame so Stage 5 features keep
// working. The joined main files are prefixed `main::`, so we rewrite the
// keys of each ancillary record to the prefixed ids.
const MAIN_PREFIX = `${MAIN_GRAPH_ID}::`;
const prefixedBlame: Record<string, FileBlame> = {};
if (mainGraph.blame) {
  for (const [id, entry] of Object.entries(mainGraph.blame)) {
    prefixedBlame[`${MAIN_PREFIX}${id}`] = { ...entry, fileId: `${MAIN_PREFIX}${entry.fileId}` };
  }
}

const prefixedHistory: GraphHistory | undefined = mainGraph.history
  ? {
      baseIndex: mainGraph.history.baseIndex,
      snapshots: mainGraph.history.snapshots.map(snap => ({
        ...snap,
        edgeIds: snap.edgeIds?.map(id => `${MAIN_PREFIX}${id}`),
        added: snap.added?.map(id => `${MAIN_PREFIX}${id}`),
        removed: snap.removed?.map(id => `${MAIN_PREFIX}${id}`),
      })),
    }
  : undefined;

const prefixedSources: Record<string, string> = {};
for (const [id, src] of Object.entries(mainSources)) {
  prefixedSources[`${MAIN_PREFIX}${id}`] = src;
}

// Effect + latency records follow the same prefix rule as blame: joined
// files live under `main::`, so the lookup tables have to match or the
// EffectBadgeRenderer / latency tint would silently miss every file.
const prefixedEffects: Record<string, FileEffects> = {};
if (mainGraph.effects) {
  for (const [id, entry] of Object.entries(mainGraph.effects)) {
    prefixedEffects[`${MAIN_PREFIX}${id}`] = { ...entry, fileId: `${MAIN_PREFIX}${entry.fileId}` };
  }
}
const prefixedLatency: Record<string, FileLatency> = {};
if (mainGraph.latency) {
  for (const [id, entry] of Object.entries(mainGraph.latency)) {
    prefixedLatency[`${MAIN_PREFIX}${id}`] = { ...entry, fileId: `${MAIN_PREFIX}${entry.fileId}` };
  }
}

// ── Trace pack synthesis (Stage 7: runtime trace overlay) ────────────
// Mock 2-3 captured "call paths" that resemble production traces. Files are
// chosen by deterministic heuristics over the joined graph so the picks
// survive graph shape changes without editing constants here. Durations
// follow plausible distributions (5..120ms per span) — the renderer scales
// width by log(totalDurationMs + 1) so the absolute numbers don't need to
// be precise, only internally consistent.

interface TraceScaffold {
  id: string;
  label: string;
  capturedOffsetMs: number;
  /** Ordered file ids forming the call chain. First = root span, last = leaf. */
  chain: string[];
  /** Base duration per depth step, ms. Each edge adds its own. */
  baseStep: number;
}

function pickByLayerAndPrefix(
  files: readonly FileNode[],
  layer: ArchLayer,
  prefixFilter: (id: string) => boolean,
  stride: number,
): string | null {
  const matching = files.filter(f => f.layer === layer && prefixFilter(f.id));
  if (matching.length === 0) return null;
  return matching[stride % matching.length].id;
}

function buildLoginTrace(graph: WorkspaceGraph): Trace | null {
  const files = graph.files;
  const available = new Set(files.map(f => f.id));
  // UI → store → adapter → domain → infra — auth service has an explicit
  // login chain we can wire end-to-end. Fall through to a synthesized
  // chain if the auth files are absent (e.g. single-graph mode).
  const chain = [
    "auth::auth-service/src/routes/login.ts",
    "auth::auth-service/src/domain/password.ts",
    "auth::auth-service/src/adapters/user-repo.ts",
    "auth::auth-service/src/domain/tokens.ts",
    "auth::auth-service/src/infra/crypto.ts",
  ].filter(id => available.has(id));
  if (chain.length < 3) return null;

  const scaffold: TraceScaffold = {
    id: "login-flow",
    label: "login flow",
    capturedOffsetMs: 0,
    chain,
    baseStep: 8,
  };
  return synthesizeTrace(scaffold, files);
}

function buildCheckoutTrace(graph: WorkspaceGraph): Trace | null {
  const files = graph.files;
  const available = new Set(files.map(f => f.id));
  const chain = [
    "auth::auth-service/src/routes/session.ts",
    "auth::auth-service/src/domain/policy.ts",
    "auth::auth-service/src/adapters/redis-store.ts",
    "auth::auth-service/src/infra/logger.ts",
  ].filter(id => available.has(id));
  if (chain.length < 3) return null;

  const scaffold: TraceScaffold = {
    id: "checkout",
    label: "checkout /api/orders",
    capturedOffsetMs: 0,
    chain,
    baseStep: 14,
  };
  return synthesizeTrace(scaffold, files);
}

function buildColdStartTrace(graph: WorkspaceGraph): Trace | null {
  // Top-3 startHere-ranked files on the main graph. startHere isn't populated
  // on the synthesized graph yet (layout-time computation), so we approximate
  // by taking the three highest-risk domain/adapter/ui files from the main
  // graph — the same signal startHere weights heaviest.
  const mainFiles = graph.files.filter(f => f.graphId === MAIN_GRAPH_ID || !f.graphId);
  if (mainFiles.length < 3) return null;
  const pickUi     = pickByLayerAndPrefix(mainFiles, "ui",     () => true, 0);
  const pickAdapt  = pickByLayerAndPrefix(mainFiles, "adapter", () => true, 0);
  const pickDom    = pickByLayerAndPrefix(mainFiles, "domain",  () => true, 0);
  const pickInfra  = pickByLayerAndPrefix(mainFiles, "infra",   () => true, 0);
  const chain = [pickUi, pickAdapt, pickDom, pickInfra]
    .filter((x): x is string => !!x);
  if (chain.length < 3) return null;

  const scaffold: TraceScaffold = {
    id: "cold-start",
    label: "cold start",
    capturedOffsetMs: 0,
    chain,
    baseStep: 22,
  };
  return synthesizeTrace(scaffold, graph.files);
}

/**
 * Turn a scaffold chain into a concrete Trace. Each chain entry becomes a
 * span at incrementing depth; each consecutive pair becomes an edge. A few
 * helper spans are inserted to make the flame-map look realistic (e.g. the
 * root span is called twice so the "×2" badge appears on at least one edge).
 */
function synthesizeTrace(scaffold: TraceScaffold, files: readonly FileNode[]): Trace {
  const byId = new Map(files.map(f => [f.id, f]));
  const spans: TraceSpan[] = [];
  const edgeAcc = new Map<string, TraceEdge>();

  let cursor = scaffold.capturedOffsetMs;
  const step = scaffold.baseStep;

  // Primary walk — one span per chain entry, increasing depth.
  for (let i = 0; i < scaffold.chain.length; i++) {
    const fileId = scaffold.chain[i];
    const f = byId.get(fileId);
    const symbol = f?.functions[0]?.name;
    const duration = step * (i === 0 ? scaffold.chain.length : scaffold.chain.length - i);
    spans.push({
      fileId,
      symbol,
      startMs: cursor,
      durationMs: duration,
      selfMs: i === scaffold.chain.length - 1 ? duration : step,
      depth: i,
    });
    cursor += step;

    if (i > 0) {
      const from = scaffold.chain[i - 1];
      const to = fileId;
      const fromFn = byId.get(from)?.functions[0]?.name;
      const key = `${from}→${to}`;
      const prev = edgeAcc.get(key);
      if (prev) {
        edgeAcc.set(key, {
          ...prev,
          callCount: prev.callCount + 1,
          totalDurationMs: prev.totalDurationMs + duration,
        });
      } else {
        edgeAcc.set(key, {
          from, to,
          fromSymbol: fromFn,
          toSymbol: symbol,
          callCount: 1,
          totalDurationMs: duration,
        });
      }
    }
  }

  // Add a second invocation of the root→first-child edge so at least one
  // "×2" badge appears in the HUD + renderer. Represents e.g. a retry.
  if (scaffold.chain.length >= 2) {
    const from = scaffold.chain[0];
    const to = scaffold.chain[1];
    const retrySymbol = byId.get(to)?.functions[0]?.name;
    const retryDur = Math.round(step * 0.6);
    spans.push({
      fileId: to,
      symbol: retrySymbol,
      startMs: cursor,
      durationMs: retryDur,
      selfMs: retryDur,
      depth: 1,
    });
    const key = `${from}→${to}`;
    const prev = edgeAcc.get(key);
    if (prev) {
      edgeAcc.set(key, {
        ...prev,
        callCount: prev.callCount + 1,
        totalDurationMs: prev.totalDurationMs + retryDur,
      });
    }
  }

  const edges: TraceEdge[] = [...edgeAcc.values()];
  const totalMs = spans.reduce((a, s) => Math.max(a, s.startMs + s.durationMs), 0);

  return {
    id: scaffold.id,
    label: scaffold.label,
    capturedAt: Date.UTC(2026, 3, 17, 12, 30),
    totalMs,
    spans,
    edges,
  };
}

function synthesizeTracePack(graph: WorkspaceGraph): TracePack | undefined {
  const out: Trace[] = [];
  const login = buildLoginTrace(graph);
  if (login) out.push(login);
  const cold = buildColdStartTrace(graph);
  if (cold) out.push(cold);
  const checkout = buildCheckoutTrace(graph);
  if (checkout) out.push(checkout);
  if (out.length === 0) return undefined;
  return { traces: out };
}

const TRACE_PACK = synthesizeTracePack({
  ...JOINED,
});

export const SAMPLE_GRAPH: WorkspaceGraph = {
  ...JOINED,
  blame: Object.keys(prefixedBlame).length > 0 ? prefixedBlame : undefined,
  history: prefixedHistory,
  traces: TRACE_PACK,
  effects: Object.keys(prefixedEffects).length > 0 ? prefixedEffects : undefined,
  latency: Object.keys(prefixedLatency).length > 0 ? prefixedLatency : undefined,
};
export const SAMPLE_SOURCES: Record<string, string> = prefixedSources;
export const SAMPLE_NAMED_GRAPHS: readonly NamedGraph[] = [NAMED_MAIN, NAMED_AUTH];
export const SAMPLE_JOIN_EDGES: readonly JoinEdge[] = JOIN_EDGES;
export default SAMPLE_GRAPH;
