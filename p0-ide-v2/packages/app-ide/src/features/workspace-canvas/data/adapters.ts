import type { FileFacts } from "@quanta/app-ide/entities/file";
import type { SymbolFacts } from "@quanta/app-ide/entities/symbol";
import type {
  WorkspaceGraph,
  FileNode,
  FileEdge,
  SymbolNode,
  SymbolNodeKind,
} from "@quanta/canvas-engine";
import { encodeSymbolId } from "@quanta/canvas-engine";

// FileFacts → WorkspaceGraph
// --------------------------------------------------------------------
// File-tier nodes are always emitted. Symbol-tier nodes are emitted
// when FileFacts.symbols is non-empty — the canvas treats
// `symbolNodes`/`symbolEdges` as optional so pre-symbol graphs keep
// rendering unchanged.
//
// Symbol-edge extraction from `SymbolFacts.deps[].name` is intentionally
// heuristic at this layer: `deps[].name` is a bare identifier with no
// fully-qualified path (see symbol/model/types.ts), so two files with a
// function named `formatDate` would alias into the same target. We emit
// an edge only when exactly one SymbolNode across the workspace matches
// the bare name; ambiguous / unresolved mentions are skipped so the
// canvas never paints a fake A→B connection. A proper call-graph
// extractor (ts-morph / LSP) is required to cover the skipped ones.

const SYMBOL_KIND_FALLBACK: SymbolNodeKind = "function";

function flattenSymbols(
  fileId: string,
  syms: readonly SymbolFacts[],
  out: SymbolNode[],
): void {
  for (const s of syms) {
    // kind narrows — SymbolFacts.kind is a superset but every value is
    // a valid SymbolNodeKind. Cast keeps the narrow type without a
    // runtime switch that would repeat the enum.
    const kind: SymbolNodeKind = (s.kind as SymbolNodeKind) ?? SYMBOL_KIND_FALLBACK;
    out.push({
      id: encodeSymbolId(fileId, s.name, s.line),
      fileId,
      name: s.name,
      kind,
      line: s.line,
      riskScore: s.riskScore,
      complexity: s.complexity,
      callers: s.callers,
      callees: s.callees,
    });
    if (s.children && s.children.length > 0) {
      flattenSymbols(fileId, s.children, out);
    }
  }
}

function collectDepMentions(
  fileId: string,
  syms: readonly SymbolFacts[],
  out: { fromId: string; dir: "outgoing" | "incoming"; name: string }[],
): void {
  for (const s of syms) {
    if (s.deps) {
      const fromId = encodeSymbolId(fileId, s.name, s.line);
      for (const dep of s.deps.outgoing) {
        out.push({ fromId, dir: "outgoing", name: dep.name });
      }
      for (const dep of s.deps.incoming) {
        out.push({ fromId, dir: "incoming", name: dep.name });
      }
    }
    if (s.children && s.children.length > 0) {
      collectDepMentions(fileId, s.children, out);
    }
  }
}

/**
 * Resolve a deps[].name to a unique SymbolNode.id. Handles two common
 * shapes: bare `"formatDate"` and dotted `"Controller.handle"` (matches
 * the method short-name `handle`). Returns null when zero or multiple
 * matches exist — we never emit ambiguous edges.
 */
function resolveBareName(
  rawName: string,
  byName: Map<string, SymbolNode[]>,
): SymbolNode | null {
  const dot = rawName.lastIndexOf(".");
  const base = dot >= 0 ? rawName.slice(dot + 1) : rawName;
  const hits = byName.get(base);
  if (!hits || hits.length !== 1) return null;
  return hits[0];
}

export function fileFactsToWorkspaceGraph(files: FileFacts[]): WorkspaceGraph {
  const nodes: FileNode[] = files.map(f => ({
    id: f.name,
    name: f.name.split("/").at(-1) ?? f.name,
    layer: "unknown" as const,
    riskScore: f.riskScore,
    loc: f.loc,
    signals: {
      taintCount: f.taintCount,
      blastCritical: f.blastCritical,
      deadCount: f.deadCount,
      archViolations: f.archViolations,
      cpxMax: f.cpxMax,
    },
    functions: f.functionHeaders.map(fh => ({
      name: fh.name,
      startLine: fh.line,
      endLine: fh.line,
      signalCount: 0,
      complexity: fh.complexity,
    })),
  }));

  const edges: FileEdge[] = [];
  // No import graph available from FileFacts directly — return empty for now.
  // Real file-level edges will come from workspace-level data.

  const symbolNodes: SymbolNode[] = [];
  for (const f of files) {
    if (f.symbols.length === 0) continue;
    flattenSymbols(f.name, f.symbols, symbolNodes);
  }

  // Build a short-name index for dep resolution (bare `formatDate` or
  // method-name half of `Ctrl.handle`). Only entries with a single match
  // survive into actual edges.
  const byName = new Map<string, SymbolNode[]>();
  for (const s of symbolNodes) {
    const bucket = byName.get(s.name);
    if (bucket) bucket.push(s);
    else byName.set(s.name, [s]);
  }

  const mentions: { fromId: string; dir: "outgoing" | "incoming"; name: string }[] = [];
  for (const f of files) {
    if (f.symbols.length === 0) continue;
    collectDepMentions(f.name, f.symbols, mentions);
  }

  const symbolEdges: FileEdge[] = [];
  const seen = new Set<string>(); // de-dupe "A→B" across outgoing+incoming mirror
  for (const m of mentions) {
    const target = resolveBareName(m.name, byName);
    if (!target) continue;
    const a = m.dir === "outgoing" ? m.fromId : target.id;
    const b = m.dir === "outgoing" ? target.id : m.fromId;
    if (a === b) continue; // self-edge from own-name mention
    const key = `${a}→${b}`;
    if (seen.has(key)) continue;
    seen.add(key);
    symbolEdges.push({
      id: `symedge:${key}`,
      from: a,
      to: b,
      kind: "call",
      layer: "structural",
      weight: 1,
      // Low confidence — extractor is name-heuristic, not AST. Renderer
      // scales edge width by this so uncertain edges render lighter.
      confidence: 0.3,
    });
  }

  return {
    files: nodes,
    fileEdges: edges,
    comments: [],
    symbolNodes: symbolNodes.length > 0 ? symbolNodes : undefined,
    symbolEdges: symbolEdges.length > 0 ? symbolEdges : undefined,
  };
}
