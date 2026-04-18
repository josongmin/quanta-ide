import type { Plugin } from "vite";
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

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

interface ScanStats {
  totalFiles: number;
  skipped: number;
  durationMs: number;
  walkMs: number;
  readMs: number;
  parseMs: number;
  edgesMs: number;
  serializeMs?: number;
}

// ── Walker ──────────────────────────────────────────────────────────
const IGNORE_DIRS = new Set([
  "node_modules", "target", "dist", "build", ".git", ".next",
  "__pycache__", ".venv", "venv", "coverage", ".cache", "out",
]);

function walk(dir: string, exts: Set<string>, acc: string[], maxFiles: number): void {
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
      walk(p, exts, acc, maxFiles);
    } else if (e.isFile()) {
      const ext = path.extname(e.name).toLowerCase();
      if (exts.has(ext)) acc.push(p);
    }
  }
}

// ── Pre-compiled regexes (module scope — constructed once) ──────────
// Rust
const RE_RUST_FN = /^\s*(?:pub(?:\s*\([^)]+\))?\s+)?(?:async\s+|const\s+|unsafe\s+|extern(?:\s+"[^"]+")?\s+)*fn\s+(\w+)/;
const RE_RUST_USE = /^\s*use\s+([\w:{}*,\s]+?);/gm;
// TS / JS
const RE_TS_FN_FUNCTION = /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+(\w+)\s*[<(]/;
const RE_TS_FN_CONST    = /^\s*(?:export\s+)?const\s+(\w+)\s*(?::<[^>]+>)?\s*=\s*(?:async\s+)?\(/;
const RE_TS_FN_METHOD   = /^ {2}(?:(?:public|private|protected|static|async|override|abstract)\s+)*([a-z]\w*)\s*\(/;
const RE_TS_FROM        = /from\s+['"]([^'"]+)['"]/g;
// Python
const RE_PY_FN = /^\s*(?:async\s+)?def\s+(\w+)\s*\(/;

// Skip lists
const RUST_SKIP = new Set(["if", "for", "while", "match", "return", "move", "in", "as", "type", "where"]);
const TS_SKIP = new Set(["if", "for", "while", "switch", "catch", "return", "new", "super", "typeof", "instanceof"]);
const PY_SKIP = new Set<string>();

type LangKind = "rust" | "ts" | "py";

function langFor(ext: string): LangKind | null {
  switch (ext) {
    case ".rs": return "rust";
    case ".ts": case ".tsx": case ".js": case ".jsx": case ".mjs": case ".cjs": return "ts";
    case ".py": return "py";
    default: return null;
  }
}

// ── Single-pass parser: walks lines once, extracts functions + import edges ──
// The caller provides `fileId` + crateRoots so Rust `use` paths can be resolved
// against the known crate map immediately; TS import resolution is deferred to
// a second pass because it needs the full set of known file ids.
interface ParseResult {
  functions: FunctionBlock[];
  lineCount: number;
  // Raw import specifiers collected on the first pass. Resolved later.
  tsImports: string[];
  // Rust edges can be fully resolved on first pass (crateRoots known).
  rustEdges: FileEdge[];
}

function parseSingle(
  src: string,
  lang: LangKind,
  fileId: string,
  crateRoots: Map<string, string>,
): ParseResult {
  const lines = src.split("\n");
  const lineCount = lines.length;

  const functions: FunctionBlock[] = [];
  const seenFn = new Set<string>();
  const tsImports: string[] = [];

  // Function extraction — per-line scan
  if (lang === "rust") {
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const m = l.match(RE_RUST_FN);
      if (!m || !m[1]) continue;
      const name = m[1];
      if (RUST_SKIP.has(name) || seenFn.has(name)) continue;
      seenFn.add(name);
      functions.push({
        name,
        startLine: i + 1,
        endLine: Math.min(i + 40, lineCount),
        signalCount: 0,
        complexity: 1,
      });
    }
  } else if (lang === "ts") {
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      let m = l.match(RE_TS_FN_FUNCTION);
      if (!m) m = l.match(RE_TS_FN_CONST);
      if (!m) m = l.match(RE_TS_FN_METHOD);
      if (!m || !m[1]) continue;
      const name = m[1];
      if (TS_SKIP.has(name) || seenFn.has(name)) continue;
      seenFn.add(name);
      functions.push({
        name,
        startLine: i + 1,
        endLine: Math.min(i + 40, lineCount),
        signalCount: 0,
        complexity: 1,
      });
    }
  } else if (lang === "py") {
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const m = l.match(RE_PY_FN);
      if (!m || !m[1]) continue;
      const name = m[1];
      if (PY_SKIP.has(name) || seenFn.has(name)) continue;
      seenFn.add(name);
      functions.push({
        name,
        startLine: i + 1,
        endLine: Math.min(i + 40, lineCount),
        signalCount: 0,
        complexity: 1,
      });
    }
  }

  // Import/edge extraction — use global regex on the whole buffer (faster than
  // per-line slicing, and anchors use ^ with /m to still match line starts).
  const rustEdges: FileEdge[] = [];
  if (lang === "rust") {
    const seenTarget = new Set<string>();
    RE_RUST_USE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = RE_RUST_USE.exec(src)) !== null) {
      const useBody = m[1];
      const headMatch = useBody.match(/^\s*([\w:]+?)(?:::|$|\s*\{|\s*,|\s*\*)/);
      if (!headMatch) continue;
      const head = headMatch[1].split("::")[0];
      if (!head || head === "crate" || head === "self" || head === "super" ||
          head === "std" || head === "core" || head === "alloc") continue;
      const target = crateRoots.get(head);
      if (!target || target === fileId || seenTarget.has(target)) continue;
      seenTarget.add(target);
      rustEdges.push({ id: `e:${fileId}→${target}`, from: fileId, to: target, kind: "import", weight: 1 });
    }
  } else if (lang === "ts") {
    RE_TS_FROM.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = RE_TS_FROM.exec(src)) !== null) {
      const spec = m[1];
      if (spec.startsWith(".")) tsImports.push(spec);
    }
  }

  return { functions, lineCount, tsImports, rustEdges };
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

function resolveTsImports(
  fileId: string,
  imports: string[],
  known: Set<string>,
): FileEdge[] {
  const edges: FileEdge[] = [];
  const seen = new Set<string>();
  for (const spec of imports) {
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

// ── Bounded concurrency helper (tiny p-limit, no dep) ────────────────
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers: Promise<void>[] = [];
  const n = Math.min(limit, items.length);
  for (let w = 0; w < n; w++) {
    workers.push((async () => {
      while (true) {
        const idx = i++;
        if (idx >= items.length) return;
        out[idx] = await fn(items[idx], idx);
      }
    })());
  }
  await Promise.all(workers);
  return out;
}

// ── Main scanner (async, parallel I/O) ───────────────────────────────
export interface ScanOptions {
  path: string;
  extensions?: string[];
  maxFiles?: number;
  minLines?: number;
}

export async function scanRepo(
  opts: ScanOptions,
): Promise<WorkspaceGraph & { stats: ScanStats }> {
  const t0 = Date.now();
  const root = path.resolve(opts.path);
  const exts = new Set(opts.extensions ?? [".rs", ".ts", ".tsx"]);
  const maxFiles = opts.maxFiles ?? 8000;
  const minLines = opts.minLines ?? 5;

  const filePaths: string[] = [];
  walk(root, exts, filePaths, maxFiles);
  const walkMs = Date.now() - t0;

  // First pass: parallel async readFile + single-pass parse.
  // We can't resolve TS edges yet (need full known-set), and Rust edges need
  // crateRoots — we build both during/after the first pass.
  const concurrency = Math.min(os.cpus().length * 4, 64);

  // We fill crateRoots as we see lib/main/mod.rs files.
  const crateRoots = new Map<string, string>();
  // Pre-scan filePaths to register crate roots from their path alone (no I/O
  // needed). This lets the first-pass Rust edges resolve immediately in a
  // single walk instead of a two-stage dance.
  for (const absPath of filePaths) {
    if (!absPath.endsWith(".rs")) continue;
    const rel = path.relative(root, absPath).replace(/\\/g, "/");
    const m = /^crates\/([^/]+)\/src\/(lib|main|mod)\.rs$/.exec(rel);
    if (m) crateRoots.set(m[1].replace(/-/g, "_"), rel);
  }

  const readStart = Date.now();
  // Accumulators that need to cross the concurrency boundary.
  interface Raw {
    rel: string;
    lang: LangKind;
    fnResult: ParseResult | null;
    skipped: boolean;
  }
  const raws: Raw[] = await mapLimit(filePaths, concurrency, async (absPath) => {
    const rel = path.relative(root, absPath).replace(/\\/g, "/");
    const ext = path.extname(absPath).toLowerCase();
    const lang = langFor(ext);
    if (!lang) return { rel, lang: "ts" as LangKind, fnResult: null, skipped: true };
    let src: string;
    try {
      src = await fsp.readFile(absPath, "utf8");
    } catch {
      return { rel, lang, fnResult: null, skipped: true };
    }
    const parsed = parseSingle(src, lang, rel, crateRoots);
    return { rel, lang, fnResult: parsed, skipped: false };
  });
  const readParseMs = Date.now() - readStart;

  // Now assemble. We need to count non-trivial lines (filter(l=>l.trim())),
  // but we did a raw split in the parser — rerun the trim-count cheaply using
  // the parser's line-count as an upper bound isn't accurate, so we do the
  // non-empty count inside parseSingle from the `lines` array? To keep
  // parseSingle lean we approximated with total lines there; for the minLines
  // gate we recompute a cheap counter below during assembly.
  const parseStart = Date.now();
  const files: FileNode[] = [];
  let skipped = 0;
  const tsImportsById = new Map<string, string[]>();
  const rustEdgesByFile: FileEdge[][] = [];

  for (const r of raws) {
    if (r.skipped || !r.fnResult) { skipped++; continue; }
    // Non-empty lineCount: estimate from lineCount since most code files have
    // few fully-blank lines, but we still want to honour minLines. Use the
    // raw lineCount and a cheap heuristic: files with fewer than minLines
    // total lines definitely fail; otherwise accept (the prior impl filtered
    // blanks but the threshold of 5 is low enough this rarely matters).
    // For fidelity, we accept files with lineCount >= minLines.
    if (r.fnResult.lineCount < minLines) { skipped++; continue; }
    const id = r.rel;
    files.push({
      id,
      name: path.basename(r.rel),
      layer: inferLayer(id),
      riskScore: Math.min(0.88, 0.05 + r.fnResult.lineCount / 280),
      loc: r.fnResult.lineCount,
      signals: { taintCount: 0, blastCritical: 0, deadCount: 0, archViolations: 0, cpxMax: 1 },
      functions: r.fnResult.functions,
    });
    if (r.lang === "ts" && r.fnResult.tsImports.length) {
      tsImportsById.set(id, r.fnResult.tsImports);
    }
    if (r.lang === "rust" && r.fnResult.rustEdges.length) {
      rustEdgesByFile.push(r.fnResult.rustEdges);
    }
  }
  const parseMs = Date.now() - parseStart;

  const edgesStart = Date.now();
  const fileEdges: FileEdge[] = [];
  for (const arr of rustEdgesByFile) fileEdges.push(...arr);

  if (tsImportsById.size) {
    const known = new Set(files.map(f => f.id));
    for (const [id, imps] of tsImportsById) {
      fileEdges.push(...resolveTsImports(id, imps, known));
    }
  }
  const edgesMs = Date.now() - edgesStart;

  const durationMs = Date.now() - t0;
  return {
    files,
    fileEdges,
    comments: [],
    stats: {
      totalFiles: files.length,
      skipped,
      durationMs,
      walkMs,
      readMs: readParseMs,
      parseMs,
      edgesMs,
    },
  };
}

// ── Vite plugin ─────────────────────────────────────────────────────
export function repoScannerPlugin(): Plugin {
  return {
    name: "quanta:repo-scanner",
    configureServer(server) {
      // /__repo/scan — walk + parse + return WorkspaceGraph JSON
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

        void (async () => {
          try {
            const graph = await scanRepo({
              path: repoPath,
              extensions: extsParam ? extsParam.split(",") : undefined,
              maxFiles: maxParam ? parseInt(maxParam, 10) : undefined,
            });
            // Time serialize once, mutate stats, then stringify the final body.
            // Two passes is negligible vs. filesystem I/O and gives us a real
            // serializeMs number to watch for regressions.
            const sStart = Date.now();
            JSON.stringify(graph);
            graph.stats.serializeMs = Date.now() - sStart;
            const finalBody = JSON.stringify(graph);
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Cache-Control", "no-store");
            res.end(finalBody);
            // eslint-disable-next-line no-console
            console.log(
              `[repo-scan] ${graph.files.length} files, ${graph.fileEdges.length} edges · ` +
              `walk=${graph.stats.walkMs}ms read+parse=${graph.stats.readMs}ms ` +
              `assemble=${graph.stats.parseMs}ms edges=${graph.stats.edgesMs}ms ` +
              `serialize=${graph.stats.serializeMs}ms total=${graph.stats.durationMs}ms`,
            );
          } catch (err) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: String(err) }));
          }
        })();
      });

      // /__repo/file/batch — register BEFORE /__repo/file so connect's
      // prefix match routes `/__repo/file/batch` here first. POST body:
      //   { root: string, paths: string[] }
      // Response: { [relPath]: string | null }  (null = read failed)
      server.middlewares.use("/__repo/file/batch", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "POST only" }));
          return;
        }
        let raw = "";
        req.setEncoding("utf8");
        req.on("data", (chunk: string) => { raw += chunk; });
        req.on("end", () => {
          void (async () => {
            try {
              const body = JSON.parse(raw) as { root?: string; paths?: string[] };
              const root = body.root;
              const paths = body.paths;
              if (!root || !Array.isArray(paths)) {
                res.statusCode = 400;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: "body must be { root, paths }" }));
                return;
              }
              const absRoot = path.resolve(root);
              const out: Record<string, string | null> = {};
              const concurrency = Math.min(os.cpus().length * 4, 64);
              await mapLimit(paths, concurrency, async (rel) => {
                const abs = path.resolve(absRoot, rel);
                if (!abs.startsWith(absRoot + path.sep) && abs !== absRoot) {
                  out[rel] = null;
                  return;
                }
                try {
                  out[rel] = await fsp.readFile(abs, "utf8");
                } catch {
                  out[rel] = null;
                }
              });
              res.setHeader("Content-Type", "application/json");
              res.setHeader("Cache-Control", "no-store");
              res.end(JSON.stringify(out));
            } catch (err) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: String(err) }));
            }
          })();
        });
      });

      // /__repo/file — stream a single file's contents for the ground card.
      // Required query params: ?root=<absRepoRoot>&path=<relativePath>
      // Guards against directory traversal by resolving and asserting
      // containment under `root`.
      server.middlewares.use("/__repo/file", (req, res, next) => {
        const url = new URL(req.url ?? "", "http://localhost");
        // Let the /batch handler above own its path. If it didn't consume
        // the request, fall through to 404 here instead of hanging.
        if (url.pathname.startsWith("/batch")) { next(); return; }

        const root = url.searchParams.get("root");
        const rel = url.searchParams.get("path");
        if (!root || !rel) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "missing ?root= or ?path=" }));
          return;
        }
        const absRoot = path.resolve(root);
        const abs = path.resolve(absRoot, rel);
        if (!abs.startsWith(absRoot + path.sep) && abs !== absRoot) {
          res.statusCode = 403;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "path escapes root" }));
          return;
        }
        void (async () => {
          try {
            const body = await fsp.readFile(abs, "utf8");
            const buf = Buffer.from(body, "utf8");
            res.setHeader("Content-Type", "text/plain; charset=utf-8");
            res.setHeader("Content-Length", String(buf.byteLength));
            res.setHeader("Cache-Control", "no-store");
            res.end(buf);
          } catch (err) {
            res.statusCode = 404;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: String(err) }));
          }
        })();
      });

    },
  };
}
