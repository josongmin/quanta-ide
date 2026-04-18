// MOCK DEV SERVER — this plugin simulates a code-graph engine via regex
// parsing over the filesystem. Production swaps this for a real engine
// (gRPC / WebSocket / API). See `GraphSource` interface in
// `packages/app-ide/src/features/workspace-canvas/data/graph-source.ts`.
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

// Mirrors the subset of @quanta/canvas-engine `FileEdge` we emit from the
// dev-server scanner. Only `import` edges come out of static import parsing
// (no taint/blast/impact synthesis here), so `layer` is always "structural".
interface FileEdge {
  id: string;
  from: string;
  to: string;
  kind: "import";
  layer: "structural";
  weight: number;
}

interface WorkspaceGraph {
  files: FileNode[];
  fileEdges: FileEdge[];
  comments: [];
}

// Breakdown of skip reasons surfaced in the scan response. Callers can
// translate these to toasts / warnings without the plugin needing UI
// smarts. Counts are independent of `skippedFiles` (which is capped at
// SKIPPED_FILES_CAP for bandwidth).
interface SkippedReason {
  "too-short": number;
  "read-error": number;
  "ignored-ext": number;
  "symlink-escape": number;
}

interface ScanStats {
  totalFiles: number;
  skipped: number;
  durationMs: number;
  walkMs: number;
  readMs: number;
  parseMs: number;
  edgesMs: number;
  // Count of edges dropped because `from` or `to` wasn't in the final
  // file set (e.g. target file was filtered by minLines, or a Rust `use`
  // resolved to a path that was skipped). Surfaced for observability so
  // a sudden spike — which would indicate a regression in resolution —
  // shows up in the HUD rather than silently shrinking the edge count.
  droppedEdges: number;
  serializeMs?: number;
  // Concurrency / retry metrics — used to surface rate-limit + timeout
  // behavior to the HUD / future observability layer.
  inFlightPeak?: number;
  timedOut?: boolean;
  queueDurationMs?: number;
}

// Cap the size of `skippedFiles` to keep the response payload bounded
// even when the walker enumerates tens of thousands of rejected files.
const SKIPPED_FILES_CAP = 50;

// How long any single scan is allowed to run before we abort and return
// a 503. 30s is generous for quanta-v2 (6k files → ~2s) and plenty for
// larger monorepos, but prevents a pathological repo from tying up the
// dev server indefinitely.
const SCAN_TIMEOUT_MS = 30_000;

// ── Walker ──────────────────────────────────────────────────────────
const IGNORE_DIRS = new Set([
  "node_modules", "target", "dist", "build", ".git", ".next",
  "__pycache__", ".venv", "venv", "coverage", ".cache", "out",
]);

// Symlink-aware containment check: resolves both sides and ensures the
// target is inside `rootReal`. Used for both HTTP endpoints and the
// walker itself so a symlink to /etc/passwd never leaks.
async function isInsideRoot(abs: string, rootReal: string): Promise<boolean> {
  try {
    const real = await fsp.realpath(abs);
    if (real === rootReal) return true;
    return real.startsWith(rootReal + path.sep);
  } catch {
    return false;
  }
}

// Sync variant used inside the walker (keeping walk synchronous avoids
// interleaving tens of thousands of lstat promises). If realpath fails
// we treat the entry as outside — better to skip than to leak.
function isInsideRootSync(abs: string, rootReal: string): boolean {
  try {
    const real = fs.realpathSync(abs);
    if (real === rootReal) return true;
    return real.startsWith(rootReal + path.sep);
  } catch {
    return false;
  }
}

// Max recursion depth. Caps pathological cases (bind-mount loops, deeply
// symlinked vendor trees) even when inode dedup is defeated by filesystems
// that report 0 or non-unique inodes (e.g. some FUSE mounts, Windows).
const MAX_WALK_DEPTH = 32;

function walk(
  dir: string,
  rootReal: string,
  exts: Set<string>,
  acc: string[],
  maxFiles: number,
  skipped: { symlinkEscapes: number },
  visitedInodes: Set<number>,
  depth: number,
): void {
  if (acc.length >= maxFiles) return;
  if (depth > MAX_WALK_DEPTH) return;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch { return; }
  for (const e of entries) {
    if (acc.length >= maxFiles) return;
    if (e.name.startsWith(".")) continue;
    if (IGNORE_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    // Symlink guard: if the entry is a symlink (or anything whose
    // realpath escapes root), skip it. Cheap fast-path: only call
    // realpath when lstat reports a symlink — regular files/dirs can't
    // escape unless they're on a bind-mount (which is rare enough that
    // the perf cost of always-checking isn't justified).
    if (e.isSymbolicLink()) {
      if (!isInsideRootSync(p, rootReal)) {
        skipped.symlinkEscapes++;
        continue;
      }
      // Fall through — symlinked dirs/files inside root are walked
      // like anything else. Use statSync to learn their real type and
      // detect cycles via inode.
      let st: fs.Stats;
      try { st = fs.statSync(p); } catch { continue; }
      if (st.isDirectory()) {
        // Inode-based cycle guard. `a/b → a` loops trigger on the
        // second traversal. Inode 0 means "don't know" (some FUSE) —
        // fall through and rely on MAX_WALK_DEPTH instead.
        if (st.ino !== 0 && visitedInodes.has(st.ino)) continue;
        if (st.ino !== 0) visitedInodes.add(st.ino);
        walk(p, rootReal, exts, acc, maxFiles, skipped, visitedInodes, depth + 1);
      } else if (st.isFile()) {
        const ext = path.extname(e.name).toLowerCase();
        if (exts.has(ext)) acc.push(p);
      }
      continue;
    }
    if (e.isDirectory()) {
      // Real directory: stat to pull the inode and dedup. Any failure
      // (EACCES, ENOENT race) → skip rather than crash the whole walk.
      let st: fs.Stats;
      try { st = fs.statSync(p); } catch { continue; }
      if (st.ino !== 0 && visitedInodes.has(st.ino)) continue;
      if (st.ino !== 0) visitedInodes.add(st.ino);
      walk(p, rootReal, exts, acc, maxFiles, skipped, visitedInodes, depth + 1);
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
  // Rust `use` specifiers collected on the first pass. Resolved later
  // against the module index once all files have been walked. We can no
  // longer resolve immediately because we want module-level granularity
  // (`use foo::bar::Baz;` → `crates/foo/src/bar.rs` not `lib.rs`).
  rustUses: string[];
}

function parseSingle(
  src: string,
  lang: LangKind,
): ParseResult {
  const lines = src.split("\n");
  const lineCount = lines.length;

  const functions: FunctionBlock[] = [];
  const seenFn = new Set<string>();
  const tsImports: string[] = [];
  const rustUses: string[] = [];

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
  if (lang === "rust") {
    RE_RUST_USE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = RE_RUST_USE.exec(src)) !== null) {
      const useBody = m[1];
      // Pull the leading "::"-joined path (everything up to a `{`, `,`,
      // `*`, or EOL). This preserves module granularity — we no longer
      // strip down to just the head segment.
      const headMatch = useBody.match(/^\s*([\w:]+)/);
      if (!headMatch) continue;
      const fullPath = headMatch[1];
      const head = fullPath.split("::")[0];
      if (!head || head === "self" || head === "super" ||
          head === "std" || head === "core" || head === "alloc") continue;
      rustUses.push(fullPath);
    }
  } else if (lang === "ts") {
    RE_TS_FROM.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = RE_TS_FROM.exec(src)) !== null) {
      const spec = m[1];
      // Relative OR @quanta/* subpath alias. The alias check is shallow
      // here (just the prefix); the actual resolution happens in the
      // second pass where we have the full known set and alias table.
      if (spec.startsWith(".") || spec.startsWith("@quanta/")) {
        tsImports.push(spec);
      }
    }
  }

  return { functions, lineCount, tsImports, rustUses };
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

const TS_EXT_CANDIDATES = ["", ".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx"];

function resolveTsBase(
  base: string,
  known: Set<string>,
): string | null {
  for (const ext of TS_EXT_CANDIDATES) {
    if (known.has(base + ext)) return base + ext;
  }
  return null;
}

function resolveTsImports(
  fileId: string,
  imports: string[],
  known: Set<string>,
  subpathAliases: Record<string, string>,
): FileEdge[] {
  const edges: FileEdge[] = [];
  const seen = new Set<string>();
  // Pre-compute sorted alias keys (longest first) so `@quanta/app-ide/foo`
  // matches `@quanta/app-ide` before any shorter overlap.
  const aliasKeys = Object.keys(subpathAliases).sort((a, b) => b.length - a.length);
  for (const spec of imports) {
    let target: string | null = null;
    if (spec.startsWith(".")) {
      const base = resolveRelative(fileId, spec);
      target = resolveTsBase(base, known);
    } else {
      // @quanta/* subpath. Match against the longest alias prefix.
      for (const key of aliasKeys) {
        if (spec === key || spec.startsWith(key + "/")) {
          const rest = spec === key ? "" : spec.slice(key.length + 1);
          const base = rest === "" ? subpathAliases[key] : `${subpathAliases[key]}/${rest}`;
          target = resolveTsBase(base, known);
          break;
        }
      }
    }
    if (target && target !== fileId && !seen.has(target)) {
      seen.add(target);
      edges.push({ id: `e:${fileId}→${target}`, from: fileId, to: target, kind: "import", layer: "structural", weight: 1 });
    }
  }
  return edges;
}

// Resolve a Rust `use foo::bar::Baz;` specifier against the precomputed
// module index. Walk from the longest possible prefix down to the shortest
// — first hit wins. This gives us `use quanta_runtime::queries::planner`
// → `crates/quanta-runtime/src/queries/planner.rs` rather than the crate
// root, which is the fidelity gain called out in #12.
function resolveRustUse(
  spec: string,
  crateRoots: Map<string, string>,
  moduleIndex: Map<string, string>,
): string | null {
  const segs = spec.split("::");
  // Skip `crate::` / `self::` / `super::` — those are relative to the
  // importer's own module and require knowing the importer's path. For
  // the simple case we treat them as a best-effort crate-root resolution
  // by the caller (see loop below).
  let startIdx = 0;
  if (segs[0] === "crate") startIdx = 1;
  // Try longest-prefix first. We iterate from the full path down to the
  // single head segment.
  const tail = segs.slice(startIdx);
  if (tail.length === 0) return null;
  for (let len = tail.length; len >= 1; len--) {
    const key = tail.slice(0, len).join("::");
    const hit = moduleIndex.get(key);
    if (hit) return hit;
  }
  // Fallback to crate root — single-segment crate reference.
  const head = tail[0];
  return crateRoots.get(head) ?? null;
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
  // Optional. When unset, the scanner auto-detects subpath aliases by
  // scanning `packages/*/src/` and mapping each to `@quanta/<dir-name>`.
  // Explicit aliases override auto-detection.
  subpathAliases?: Record<string, string>;
}

// Tracks in-flight scans by absolute root path. Rejecting duplicate
// scans of the same path prevents walking the same tree twice when the
// UI hot-reloads or the user double-clicks. Module-level so it persists
// across requests within a single Vite dev server lifetime.
const scansInFlight = new Set<string>();

export interface ScanResult extends WorkspaceGraph {
  stats: ScanStats;
  // New: capped list of skipped file paths + reason breakdown so callers
  // can surface toasts ("N files skipped because too short to parse…").
  skippedFiles: string[];
  skippedReason: SkippedReason;
}

export async function scanRepo(
  opts: ScanOptions,
): Promise<ScanResult> {
  const t0 = Date.now();
  const root = path.resolve(opts.path);
  // Resolve once so the walker / endpoints both compare against the
  // canonical target (handles case where `opts.path` itself is a symlink
  // into the repo).
  const rootReal = await fsp.realpath(root);
  const exts = new Set(opts.extensions ?? [".rs", ".ts", ".tsx"]);
  const maxFiles = opts.maxFiles ?? 8000;
  const minLines = opts.minLines ?? 5;

  const filePaths: string[] = [];
  const walkSkip = { symlinkEscapes: 0 };
  // Seed the inode-visited set with the root's own inode so a symlink
  // back to root is caught on the first nested traversal.
  const visitedInodes = new Set<number>();
  try {
    const rootSt = fs.statSync(rootReal);
    if (rootSt.ino !== 0) visitedInodes.add(rootSt.ino);
  } catch {
    // Non-fatal: realpath succeeded above, so stat failing here would be
    // a TOCTOU-level race. Fall through with an empty visited set.
  }
  walk(rootReal, rootReal, exts, filePaths, maxFiles, walkSkip, visitedInodes, 0);
  const walkMs = Date.now() - t0;

  // First pass: parallel async readFile + single-pass parse.
  // Rust `use` + TS imports are both deferred until we've walked every
  // file — Rust needs the module index, TS needs the full known-set +
  // alias table.
  const concurrency = Math.min(os.cpus().length * 4, 64);

  // Auto-detect subpath aliases if none provided. We look for
  // `packages/*/src` top-level dirs and map each to `@quanta/<name>`.
  // Explicit `opts.subpathAliases` overrides auto-detection so CI / tests
  // can pin a specific mapping.
  let subpathAliases = opts.subpathAliases;
  if (!subpathAliases) {
    subpathAliases = {};
    try {
      const pkgsAbs = path.join(rootReal, "packages");
      const st = await fsp.stat(pkgsAbs).catch(() => null);
      if (st?.isDirectory()) {
        const entries = await fsp.readdir(pkgsAbs, { withFileTypes: true });
        for (const e of entries) {
          if (!e.isDirectory()) continue;
          const srcAbs = path.join(pkgsAbs, e.name, "src");
          const srcSt = await fsp.stat(srcAbs).catch(() => null);
          if (srcSt?.isDirectory()) {
            subpathAliases[`@quanta/${e.name}`] = `packages/${e.name}/src`;
          }
        }
      }
    } catch {
      // Non-fatal — auto-detect failures just mean no aliases resolved.
    }
  }

  // Build crate roots + module index from the walker's file list. Both
  // are cheap (path-only) so we can do them in a single loop without
  // any I/O. The module index is keyed by fully-qualified
  // `<crate>::<module-path>` and maps to the rel file id.
  const crateRoots = new Map<string, string>();
  const moduleIndex = new Map<string, string>();
  for (const absPath of filePaths) {
    if (!absPath.endsWith(".rs")) continue;
    const rel = path.relative(rootReal, absPath).replace(/\\/g, "/");
    // Crate root (lib/main/mod.rs at <crate>/src/): register crate name.
    const crateMatch = /^crates\/([^/]+)\/src\/(lib|main|mod)\.rs$/.exec(rel);
    if (crateMatch) {
      const crate = crateMatch[1].replace(/-/g, "_");
      crateRoots.set(crate, rel);
      moduleIndex.set(crate, rel);
      continue;
    }
    // Generic crate module: crates/<crate>/src/<path>.rs → module path
    // is `<crate>::<segs-without-.rs>` (dashes → underscores to match
    // Rust's `use` convention). For `mod.rs` the module is the parent
    // directory rather than `mod` itself.
    const modMatch = /^crates\/([^/]+)\/src\/(.+)\.rs$/.exec(rel);
    if (!modMatch) continue;
    const crate = modMatch[1].replace(/-/g, "_");
    let modPath = modMatch[2];
    if (modPath.endsWith("/mod")) modPath = modPath.slice(0, -4);
    if (modPath === "") continue;
    const modId = `${crate}::${modPath.replace(/\//g, "::").replace(/-/g, "_")}`;
    moduleIndex.set(modId, rel);
  }

  const readStart = Date.now();
  // Accumulators that need to cross the concurrency boundary.
  interface Raw {
    rel: string;
    lang: LangKind;
    fnResult: ParseResult | null;
    skipped: boolean;
    skipReason: "read-error" | "ignored-ext" | null;
  }
  const raws: Raw[] = await mapLimit(filePaths, concurrency, async (absPath) => {
    const rel = path.relative(rootReal, absPath).replace(/\\/g, "/");
    const ext = path.extname(absPath).toLowerCase();
    const lang = langFor(ext);
    if (!lang) return { rel, lang: "ts" as LangKind, fnResult: null, skipped: true, skipReason: "ignored-ext" };
    let src: string;
    try {
      src = await fsp.readFile(absPath, "utf8");
    } catch {
      return { rel, lang, fnResult: null, skipped: true, skipReason: "read-error" };
    }
    const parsed = parseSingle(src, lang);
    return { rel, lang, fnResult: parsed, skipped: false, skipReason: null };
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
  const skippedFiles: string[] = [];
  const skippedReason: SkippedReason = {
    "too-short": 0,
    "read-error": 0,
    "ignored-ext": 0,
    "symlink-escape": walkSkip.symlinkEscapes,
  };
  skipped += walkSkip.symlinkEscapes;
  const tsImportsById = new Map<string, string[]>();
  const rustUsesByFile: Array<{ id: string; specs: string[] }> = [];

  const pushSkip = (rel: string, reason: keyof SkippedReason): void => {
    skipped++;
    skippedReason[reason]++;
    if (skippedFiles.length < SKIPPED_FILES_CAP) skippedFiles.push(rel);
  };

  for (const r of raws) {
    if (r.skipped || !r.fnResult) {
      if (r.skipReason) pushSkip(r.rel, r.skipReason);
      else skipped++;
      continue;
    }
    // Non-empty lineCount: estimate from lineCount since most code files have
    // few fully-blank lines, but we still want to honour minLines. Use the
    // raw lineCount and a cheap heuristic: files with fewer than minLines
    // total lines definitely fail; otherwise accept (the prior impl filtered
    // blanks but the threshold of 5 is low enough this rarely matters).
    // For fidelity, we accept files with lineCount >= minLines.
    if (r.fnResult.lineCount < minLines) {
      pushSkip(r.rel, "too-short");
      continue;
    }
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
    if (r.lang === "rust" && r.fnResult.rustUses.length) {
      rustUsesByFile.push({ id, specs: r.fnResult.rustUses });
    }
  }
  const parseMs = Date.now() - parseStart;

  const edgesStart = Date.now();
  const fileEdges: FileEdge[] = [];
  // Build the known-file set once — used by both Rust and TS edge
  // filtering. Rust `resolveRustUse` may resolve to a path that was
  // filtered out (e.g. lib.rs with lineCount < minLines), and TS
  // `resolveTsImports` passes this through resolveTsBase but callers
  // mutated `files` post-resolution in earlier revisions, so we apply
  // an explicit drop filter on both paths for robustness.
  const known = new Set(files.map(f => f.id));
  let droppedEdges = 0;

  // Rust edges — resolve now that we have the full module index.
  for (const { id, specs } of rustUsesByFile) {
    const seen = new Set<string>();
    for (const spec of specs) {
      const target = resolveRustUse(spec, crateRoots, moduleIndex);
      if (!target || target === id || seen.has(target)) continue;
      seen.add(target);
      // Drop edges whose source or target didn't survive to the final
      // file set. `id` is always in `known` (we only push onto
      // rustUsesByFile for accepted files), but `target` may not be.
      if (!known.has(id) || !known.has(target)) {
        droppedEdges++;
        continue;
      }
      fileEdges.push({ id: `e:${id}→${target}`, from: id, to: target, kind: "import", layer: "structural", weight: 1 });
    }
  }

  if (tsImportsById.size) {
    for (const [id, imps] of tsImportsById) {
      const resolved = resolveTsImports(id, imps, known, subpathAliases);
      for (const edge of resolved) {
        if (!known.has(edge.from) || !known.has(edge.to)) {
          droppedEdges++;
          continue;
        }
        fileEdges.push(edge);
      }
    }
  }
  const edgesMs = Date.now() - edgesStart;

  const durationMs = Date.now() - t0;
  return {
    files,
    fileEdges,
    comments: [],
    skippedFiles,
    skippedReason,
    stats: {
      totalFiles: files.length,
      skipped,
      durationMs,
      walkMs,
      readMs: readParseMs,
      parseMs,
      edgesMs,
      droppedEdges,
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

        // Normalize once so the in-flight set keys are stable (symlinks
        // or trailing slashes from the client don't create duplicates).
        const queueKey = path.resolve(repoPath);
        // Rate limit: reject duplicate concurrent scans of the same
        // path. Returning 429 lets the caller back off without risk of
        // two overlapping walks hammering the filesystem.
        if (scansInFlight.has(queueKey)) {
          res.statusCode = 429;
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Retry-After", "5");
          res.end(JSON.stringify({ error: `scan already in progress for ${queueKey}` }));
          return;
        }
        scansInFlight.add(queueKey);

        void (async () => {
          const queuedAt = Date.now();
          let timedOut = false;
          try {
            // Race the scan against a hard-timeout. On timeout we don't
            // try to abort the walker (no AbortController plumbed yet)
            // — the promise continues to resolve in the background and
            // the in-flight entry is cleared in `finally`, so the next
            // request can try again.
            const scanPromise = scanRepo({
              path: repoPath,
              extensions: extsParam ? extsParam.split(",") : undefined,
              maxFiles: maxParam ? parseInt(maxParam, 10) : undefined,
            });
            const timeoutPromise = new Promise<never>((_, reject) => {
              setTimeout(() => {
                timedOut = true;
                reject(new Error(`scan timed out after ${SCAN_TIMEOUT_MS}ms`));
              }, SCAN_TIMEOUT_MS);
            });
            const graph = await Promise.race([scanPromise, timeoutPromise]);
            // Time serialize once, mutate stats, then stringify the final body.
            // Two passes is negligible vs. filesystem I/O and gives us a real
            // serializeMs number to watch for regressions.
            const sStart = Date.now();
            JSON.stringify(graph);
            graph.stats.serializeMs = Date.now() - sStart;
            graph.stats.inFlightPeak = scansInFlight.size;
            graph.stats.timedOut = false;
            graph.stats.queueDurationMs = Date.now() - queuedAt;
            const finalBody = JSON.stringify(graph);
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Cache-Control", "no-store");
            res.end(finalBody);
            // eslint-disable-next-line no-console
            console.log(
              `[repo-scan] ${graph.files.length} files, ${graph.fileEdges.length} edges ` +
              `(dropped=${graph.stats.droppedEdges}) · ` +
              `walk=${graph.stats.walkMs}ms read+parse=${graph.stats.readMs}ms ` +
              `assemble=${graph.stats.parseMs}ms edges=${graph.stats.edgesMs}ms ` +
              `serialize=${graph.stats.serializeMs}ms total=${graph.stats.durationMs}ms ` +
              `skipped=${graph.stats.skipped} (too-short=${graph.skippedReason["too-short"]} ` +
              `read-err=${graph.skippedReason["read-error"]} symlink-escape=${graph.skippedReason["symlink-escape"]})`,
            );
          } catch (err) {
            if (timedOut) {
              res.statusCode = 503;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({
                error: String(err),
                timedOut: true,
                limitMs: SCAN_TIMEOUT_MS,
              }));
            } else {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: String(err) }));
            }
          } finally {
            scansInFlight.delete(queueKey);
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
              // Resolve once so symlink-escape checks compare against
              // the canonical root. Failure here means the root itself
              // is invalid — reject with 404 rather than silently
              // returning a map of nulls.
              let rootReal: string;
              try {
                rootReal = await fsp.realpath(absRoot);
              } catch {
                res.statusCode = 404;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: "root not found" }));
                return;
              }
              const out: Record<string, string | null> = {};
              const concurrency = Math.min(os.cpus().length * 4, 64);
              await mapLimit(paths, concurrency, async (rel) => {
                const abs = path.resolve(absRoot, rel);
                // Lexical guard first (cheap, catches `../` tricks),
                // then realpath guard (catches symlinks). Rejecting at
                // the file level (null) is safer than throwing — a bad
                // path in one batch entry shouldn't fail the whole
                // request.
                if (!abs.startsWith(absRoot + path.sep) && abs !== absRoot) {
                  out[rel] = null;
                  return;
                }
                if (!(await isInsideRoot(abs, rootReal))) {
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
        // Lexical containment check — cheap fast-path that catches plain
        // `../` traversal before any I/O.
        if (!abs.startsWith(absRoot + path.sep) && abs !== absRoot) {
          res.statusCode = 403;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "path escapes root" }));
          return;
        }
        void (async () => {
          try {
            // Symlink guard: compare realpath of target vs root so a
            // symlink inside the repo cannot point at anything outside
            // it (e.g. `~/.ssh/id_rsa`).
            const rootReal = await fsp.realpath(absRoot);
            if (!(await isInsideRoot(abs, rootReal))) {
              res.statusCode = 403;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "path escapes root (symlink)" }));
              return;
            }
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
