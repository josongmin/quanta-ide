import type { Plugin } from "vite";
import * as fs from "node:fs";
import * as path from "node:path";

// ── Types (must match @quanta/canvas-engine/graph/types) ────────────
type ArchLayer = "domain" | "adapter" | "infra" | "ui" | "util" | "unknown";

interface FunctionBlock {
  name: string;
  startLine: number;
  endLine: number;
  signalCount: number;
  complexity: number;
}

interface FileNode {
  id: string;
  name: string;
  layer: ArchLayer;
  riskScore: number;
  loc: number;
  signals: { taintCount: number; blastCritical: number; deadCount: number; archViolations: number; cpxMax: number };
  functions: FunctionBlock[];
}

interface FileEdge {
  id: string;
  from: string;
  to: string;
  kind: "import" | "taint-propagation" | "blast";
  weight: number;
}

interface WorkspaceGraph {
  files: FileNode[];
  fileEdges: FileEdge[];
  comments: [];
}

// ── Walker ──────────────────────────────────────────────────────────
const IGNORE_DIRS = new Set([
  "node_modules", "target", "dist", "build", ".git", ".next",
  "__pycache__", ".venv", "venv", "coverage", ".cache", "out",
]);

function walk(dir: string, exts: Set<string>, acc: string[], rootLen: number, maxFiles: number): void {
  if (acc.length >= maxFiles) return;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch { return; }
  for (const e of entries) {
    if (acc.length >= maxFiles) return;
    if (e.name.startsWith(".")) continue;
    if (IGNORE_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      walk(p, exts, acc, rootLen, maxFiles);
    } else if (e.isFile()) {
      const ext = path.extname(e.name).toLowerCase();
      if (exts.has(ext)) acc.push(p);
    }
  }
}

// ── Per-language extractors ─────────────────────────────────────────
interface LangSpec {
  fnRegexes: RegExp[];
  importResolvers: Array<(spec: string, fromId: string, known: Set<string>) => string | null>;
  importRegex: RegExp;
  skipFn: Set<string>;
}

const RUST_SPEC: LangSpec = {
  fnRegexes: [
    /^\s*(?:pub(?:\s*\([^)]+\))?\s+)?(?:async\s+|const\s+|unsafe\s+|extern(?:\s+"[^"]+")?\s+)*fn\s+(\w+)/,
  ],
  importRegex: /^\s*use\s+([\w:{}*,\s]+);/gm,
  importResolvers: [],
  skipFn: new Set(["if", "for", "while", "match", "return", "move", "in", "as", "type", "where"]),
};

const TS_SPEC: LangSpec = {
  fnRegexes: [
    /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+(\w+)\s*[<(]/,
    /^\s*(?:export\s+)?const\s+(\w+)\s*(?::<[^>]+>)?\s*=\s*(?:async\s+)?\(/,
    /^ {2}(?:(?:public|private|protected|static|async|override|abstract)\s+)*([a-z]\w*)\s*\(/,
  ],
  importRegex: /from\s+['"]([^'"]+)['"]/g,
  importResolvers: [],
  skipFn: new Set(["if", "for", "while", "switch", "catch", "return", "new", "super", "typeof", "instanceof"]),
};

const PY_SPEC: LangSpec = {
  fnRegexes: [
    /^\s*(?:async\s+)?def\s+(\w+)\s*\(/,
  ],
  importRegex: /^\s*(?:from\s+([.\w]+)\s+import|import\s+([.\w]+))/gm,
  importResolvers: [],
  skipFn: new Set(),
};

function specFor(ext: string): LangSpec | null {
  switch (ext) {
    case ".rs": return RUST_SPEC;
    case ".ts": case ".tsx": case ".js": case ".jsx": case ".mjs": case ".cjs": return TS_SPEC;
    case ".py": return PY_SPEC;
    default: return null;
  }
}

function parseFunctions(src: string, spec: LangSpec): FunctionBlock[] {
  const lines = src.split("\n");
  const out: FunctionBlock[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    let name: string | undefined;
    for (const re of spec.fnRegexes) {
      const m = l.match(re);
      if (m?.[1]) { name = m[1]; break; }
    }
    if (!name || spec.skipFn.has(name) || seen.has(name)) continue;
    seen.add(name);
    out.push({
      name,
      startLine: i + 1,
      endLine: Math.min(i + 40, lines.length),
      signalCount: 0,
      complexity: 1,
    });
  }
  return out;
}

// ── Rust edge extraction via crate-qualified `use` paths ─────────────
// For a monorepo of crates, we map `use crate_name::...` to crate root files.
// We also handle intra-crate `crate::` and relative `super::`.
function extractRustEdges(
  fileId: string,
  src: string,
  filesById: Map<string, FileNode>,
  crateRoots: Map<string, string>, // crateName → canonical file id
): FileEdge[] {
  const edges: FileEdge[] = [];
  const seen = new Set<string>();
  const re = /^\s*use\s+([\w:{}*,\s]+?);/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const useBody = m[1];
    // Extract the first path segment after `use `
    const headMatch = useBody.match(/^\s*([\w:]+?)(?:::|$|\s*\{|\s*,|\s*\*)/);
    if (!headMatch) continue;
    const head = headMatch[1].split("::")[0];
    if (!head || head === "crate" || head === "self" || head === "super" || head === "std" || head === "core" || head === "alloc") continue;
    const target = crateRoots.get(head);
    if (!target || target === fileId || seen.has(target)) continue;
    if (!filesById.has(target)) continue;
    seen.add(target);
    edges.push({ id: `e:${fileId}→${target}`, from: fileId, to: target, kind: "import", weight: 1 });
  }
  return edges;
}

function extractTsEdges(
  fileId: string,
  src: string,
  known: Set<string>,
): FileEdge[] {
  const edges: FileEdge[] = [];
  const seen = new Set<string>();
  const re = /from\s+['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const spec = m[1];
    if (!spec.startsWith(".")) continue;
    const base = resolveRelative(fileId, spec);
    let target: string | null = null;
    for (const ext of ["", ".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx"]) {
      if (known.has(base + ext)) { target = base + ext; break; }
    }
    if (target && target !== fileId && !seen.has(target)) {
      seen.add(target);
      edges.push({ id: `e:${fileId}→${target}`, from: fileId, to: target, kind: "import", weight: 1 });
    }
  }
  return edges;
}

function resolveRelative(fromId: string, rel: string): string {
  const parts = [...fromId.split("/").slice(0, -1), ...rel.split("/")];
  const out: string[] = [];
  for (const p of parts) {
    if (p === "..") out.pop();
    else if (p !== "." && p !== "") out.push(p);
  }
  return out.join("/");
}

// ── Layer inference (best-effort) ────────────────────────────────────
function inferLayer(id: string): ArchLayer {
  // Rust conventions
  if (/\/ports?\//.test(id) || /contract-ports/.test(id) || id.endsWith("_port.rs")) return "domain";
  if (/\/adapters?\//.test(id)) return "adapter";
  if (/\/infra\//.test(id) || /\/storage\//.test(id)) return "infra";
  if (/\/ui\//.test(id) || /\/components\//.test(id)) return "ui";
  if (/\/util(?:s|ities)?\//.test(id) || /\/hooks\//.test(id)) return "util";
  // TS conventions
  if (/\/(entities|features|widgets|app-|apps?)\//.test(id)) return "ui";
  if (/\/(stores?|state)\//.test(id)) return "infra";
  return "unknown";
}

// ── Main scanner ────────────────────────────────────────────────────
export interface ScanOptions {
  path: string;
  extensions?: string[];
  maxFiles?: number;
  minLines?: number;
}

export function scanRepo(opts: ScanOptions): WorkspaceGraph & { stats: { totalFiles: number; skipped: number; durationMs: number } } {
  const t0 = Date.now();
  const root = path.resolve(opts.path);
  const exts = new Set(opts.extensions ?? [".rs", ".ts", ".tsx"]);
  const maxFiles = opts.maxFiles ?? 8000;
  const minLines = opts.minLines ?? 5;

  const filePaths: string[] = [];
  walk(root, exts, filePaths, root.length + 1, maxFiles);

  const files: FileNode[] = [];
  const srcById = new Map<string, string>();
  const crateRoots = new Map<string, string>(); // crate name → canonical file id

  let skipped = 0;
  for (const absPath of filePaths) {
    let src: string;
    try {
      src = fs.readFileSync(absPath, "utf8");
    } catch { skipped++; continue; }
    const lineCount = src.split("\n").filter(l => l.trim()).length;
    if (lineCount < minLines) { skipped++; continue; }
    const rel = path.relative(root, absPath).replace(/\\/g, "/");
    const ext = path.extname(absPath).toLowerCase();
    const spec = specFor(ext);
    if (!spec) { skipped++; continue; }
    const fns = parseFunctions(src, spec);
    const id = rel;
    srcById.set(id, src);
    files.push({
      id,
      name: path.basename(rel),
      layer: inferLayer(id),
      riskScore: Math.min(0.88, 0.05 + lineCount / 280),
      loc: lineCount,
      signals: { taintCount: 0, blastCritical: 0, deadCount: 0, archViolations: 0, cpxMax: 1 },
      functions: fns,
    });
    // Register crate roots (Rust)
    if (ext === ".rs") {
      const m = /^crates\/([^/]+)\/src\/(lib|main|mod)\.rs$/.exec(id);
      if (m) crateRoots.set(m[1].replace(/-/g, "_"), id);
    }
  }

  const known = new Set(files.map(f => f.id));
  const filesById = new Map(files.map(f => [f.id, f]));
  const fileEdges: FileEdge[] = [];
  for (const f of files) {
    const src = srcById.get(f.id) ?? "";
    const ext = path.extname(f.id).toLowerCase();
    if (ext === ".rs") {
      fileEdges.push(...extractRustEdges(f.id, src, filesById, crateRoots));
    } else {
      fileEdges.push(...extractTsEdges(f.id, src, known));
    }
  }

  return {
    files,
    fileEdges,
    comments: [],
    stats: {
      totalFiles: files.length,
      skipped,
      durationMs: Date.now() - t0,
    },
  };
}

// ── Vite plugin ─────────────────────────────────────────────────────
export function repoScannerPlugin(): Plugin {
  return {
    name: "quanta:repo-scanner",
    configureServer(server) {
      server.middlewares.use("/__repo/scan", (req, res) => {
        const url = new URL(req.url ?? "", "http://localhost");
        const repoPath = url.searchParams.get("path");
        const extsParam = url.searchParams.get("exts");
        const maxParam = url.searchParams.get("max");

        if (!repoPath) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "missing ?path=" }));
          return;
        }
        if (!fs.existsSync(repoPath)) {
          res.statusCode = 404;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: `path not found: ${repoPath}` }));
          return;
        }

        try {
          const graph = scanRepo({
            path: repoPath,
            extensions: extsParam ? extsParam.split(",") : undefined,
            maxFiles: maxParam ? parseInt(maxParam, 10) : undefined,
          });
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Cache-Control", "no-store");
          res.end(JSON.stringify(graph));
        } catch (err) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: String(err) }));
        }
      });
    },
  };
}
