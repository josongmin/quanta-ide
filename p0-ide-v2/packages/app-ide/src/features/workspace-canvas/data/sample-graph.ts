import type { WorkspaceGraph, FileNode, FileEdge, FunctionBlock, ArchLayer } from "@quanta/canvas-engine";

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
      edges.push({ id: `e:${fileId}→${target}`, from: fileId, to: target, kind: "import", weight: 1 });
    }
  }
  return edges;
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
  const fileEdges: FileEdge[] = files.flatMap(f => extractEdges(f.id, sources[f.id] ?? "", known));

  return { graph: { files, fileEdges, comments: [] }, sources };
}

const { graph, sources } = build();

export const SAMPLE_GRAPH: WorkspaceGraph = graph;
export const SAMPLE_SOURCES: Record<string, string> = sources;
