// Git history dev-server plugin. Shells out to `git` to fetch commit
// metas + per-commit file lists for the canvas temporal UI, and caches
// results to an NDJSON file under the user's home so subsequent dev
// starts pay only for commits newer than the last cached one.
//
// Endpoints:
//   GET /__git/log?limit=500&since=<epochMs>&repo=<path>  → { commits: CommitMeta[] }
//   GET /__git/delta/<sha>?repo=<path>                    → CommitDelta
//
// Failure modes:
//   - `git` not on PATH or not a repo → every endpoint responds 503 and
//     an explicit `{ error }` payload. GitHistorySource treats this as
//     "return empty"; callers then fall back to MockHistorySource.
//   - NDJSON cache errors are non-fatal — we log + continue uncached.
//
// We deliberately keep the plugin small: just `git log --pretty=... --numstat`
// parsing + a hash-stable delta synthesis. Production will replace the
// delta synthesis with a real AST-aware dependency diff.

import type { Plugin } from "vite";
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { execFile } from "node:child_process";

// ── Types (mirror `canvas-engine/graph/history-source`) ────────────
interface CommitMeta {
  sha: string;
  shortSha: string;
  timestamp: number;
  author: string;
  authorEmail?: string;
  message: string;
  filesChanged: readonly string[];
  additions: number;
  deletions: number;
  parentShas: readonly string[];
}

interface CommitDelta {
  sha: string;
  added: readonly string[];
  removed: readonly string[];
}

// ── Config ──────────────────────────────────────────────────────────

// Home-dir cache root. Keeps per-repo NDJSON files so multiple repos
// open on the same machine don't cross-pollute caches.
const CACHE_ROOT = path.join(os.homedir(), "quanta-ide-git-cache");

// Default commit cap for a cold start. High enough to cover ~1 year of
// activity for most repos while keeping the initial payload bounded.
const DEFAULT_LIMIT = 500;

// Hard timeout for a `git log` invocation — prevents the dev server
// from hanging if the user points at a giant repo with no shallow clone.
const GIT_TIMEOUT_MS = 15_000;

// Upper bound on one NDJSON file. Older commits past this get truncated
// on the next write; we'd rather lose history than bloat the home dir.
const MAX_CACHED_COMMITS = 2000;

// Promisified execFile — we always pass args as an array so user input
// can't shell-inject through a commit SHA or repo path.
function exec(
  cmd: string,
  args: readonly string[],
  opts: { cwd?: string; timeoutMs?: number } = {},
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      cmd,
      args as string[],
      { cwd: opts.cwd, maxBuffer: 64 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) reject(err);
        else resolve({ stdout: String(stdout), stderr: String(stderr) });
      },
    );
    if (opts.timeoutMs) {
      setTimeout(() => {
        try { child.kill("SIGKILL"); } catch { /* ignore */ }
      }, opts.timeoutMs);
    }
  });
}

function repoKeyFor(repoPath: string): string {
  // Stable key from the absolute path. We don't include the basename
  // directly to avoid collisions like "my-app" in two parent dirs; a
  // shallow hash + basename is plenty.
  const abs = path.resolve(repoPath);
  const base = path.basename(abs) || "root";
  let h = 5381;
  for (let i = 0; i < abs.length; i++) h = ((h << 5) + h + abs.charCodeAt(i)) | 0;
  return `${base}-${(h >>> 0).toString(16)}`;
}

async function ensureCacheDir(repoKey: string): Promise<string> {
  const dir = path.join(CACHE_ROOT, repoKey);
  await fsp.mkdir(dir, { recursive: true });
  return dir;
}

async function readCachedCommits(repoKey: string): Promise<CommitMeta[]> {
  const file = path.join(CACHE_ROOT, repoKey, "commits.ndjson");
  try {
    const raw = await fsp.readFile(file, "utf8");
    const out: CommitMeta[] = [];
    for (const line of raw.split("\n")) {
      const l = line.trim();
      if (!l) continue;
      try {
        const parsed = JSON.parse(l) as CommitMeta;
        if (parsed && typeof parsed.sha === "string") out.push(parsed);
      } catch {
        // Drop individual bad lines — don't fail the whole cache.
      }
    }
    return out;
  } catch {
    return [];
  }
}

async function writeCachedCommits(
  repoKey: string,
  commits: readonly CommitMeta[],
): Promise<void> {
  try {
    const dir = await ensureCacheDir(repoKey);
    const file = path.join(dir, "commits.ndjson");
    // Newest first; truncate to MAX_CACHED_COMMITS.
    const capped = commits.slice(0, MAX_CACHED_COMMITS);
    const lines = capped.map(c => JSON.stringify(c)).join("\n") + "\n";
    await fsp.writeFile(file, lines, "utf8");
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[git-history] failed to persist cache: ${String(err)}`);
  }
}

// Parse a single `git log --pretty=format:...` block. Format we request:
//   <sha>\x1f<shortSha>\x1f<committerEpoch>\x1f<author>\x1f<email>\x1f<parents>\x1f<subject>
// Then a newline, then `--numstat` lines `ADD\tDEL\tPATH`.
//
// We use \x1f as the field separator because it cannot legally appear in
// a git ident / subject, so parsing is unambiguous without quoting.
const FIELD_SEP = "\x1f";
const RECORD_SEP = "\x1e"; // between commits

async function gitLog(repoPath: string, limit: number, since?: number): Promise<CommitMeta[]> {
  const pretty =
    `${RECORD_SEP}%H${FIELD_SEP}%h${FIELD_SEP}%ct${FIELD_SEP}%an${FIELD_SEP}` +
    `%ae${FIELD_SEP}%P${FIELD_SEP}%s`;
  const args = [
    "log",
    `--pretty=format:${pretty}`,
    "--numstat",
    `-n`, String(limit),
  ];
  if (typeof since === "number") args.push(`--since=${Math.floor(since / 1000)}`);
  const { stdout } = await exec("git", args, {
    cwd: repoPath,
    timeoutMs: GIT_TIMEOUT_MS,
  });

  const commits: CommitMeta[] = [];
  // Split on RECORD_SEP — the first chunk is empty because the format
  // starts with RECORD_SEP.
  const chunks = stdout.split(RECORD_SEP);
  for (const chunk of chunks) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;
    const [header, ...rest] = trimmed.split("\n");
    const fields = header.split(FIELD_SEP);
    if (fields.length < 7) continue;
    const [sha, shortSha, ctRaw, author, email, parentsRaw, ...subjectParts] = fields;
    // Subject itself might contain FIELD_SEP if a commit message uses
    // unit-separator — extremely rare, but join back to be safe.
    const subject = subjectParts.join(FIELD_SEP);
    const timestamp = Number(ctRaw) * 1000;
    if (!sha || Number.isNaN(timestamp)) continue;
    const parentShas = parentsRaw ? parentsRaw.split(" ").filter(Boolean) : [];
    let additions = 0;
    let deletions = 0;
    const filesChanged: string[] = [];
    for (const line of rest) {
      const l = line.trim();
      if (!l) continue;
      // numstat: ADD\tDEL\tPATH. Binary files show "-\t-\tPATH".
      const parts = l.split("\t");
      if (parts.length < 3) continue;
      const add = parts[0] === "-" ? 0 : Number(parts[0]);
      const del = parts[1] === "-" ? 0 : Number(parts[1]);
      additions += Number.isFinite(add) ? add : 0;
      deletions += Number.isFinite(del) ? del : 0;
      filesChanged.push(parts.slice(2).join("\t"));
    }
    commits.push({
      sha,
      shortSha,
      timestamp,
      author,
      authorEmail: email || undefined,
      message: subject,
      filesChanged,
      additions,
      deletions,
      parentShas,
    });
  }
  return commits;
}

async function gitDeltaFiles(
  repoPath: string,
  sha: string,
): Promise<readonly string[]> {
  // `git diff --name-only <sha>^ <sha>`. For root commits (no parent),
  // fall back to `git show --pretty=format: --name-only <sha>` which
  // lists every file touched.
  try {
    const { stdout } = await exec(
      "git",
      ["diff", "--name-only", `${sha}^`, sha],
      { cwd: repoPath, timeoutMs: GIT_TIMEOUT_MS },
    );
    return stdout.split("\n").map(s => s.trim()).filter(Boolean);
  } catch {
    try {
      const { stdout } = await exec(
        "git",
        ["show", "--pretty=format:", "--name-only", sha],
        { cwd: repoPath, timeoutMs: GIT_TIMEOUT_MS },
      );
      return stdout.split("\n").map(s => s.trim()).filter(Boolean);
    } catch {
      return [];
    }
  }
}

// Synthesize a stable-but-arbitrary CommitDelta from a file list. Real
// edge-aware diffing lives in a later task; the client-side helper
// `deltaFromFileChanges` uses the same hash scheme, but we re-implement
// here because the plugin has no easy way to import ESM TS from
// `packages/canvas-engine` during Vite startup.
function hashBucket(s: string): 0 | 1 {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h & 1) as 0 | 1;
}

function synthesizeDelta(
  sha: string,
  filesChanged: readonly string[],
): CommitDelta {
  // Without a graph on the server-side, we can't map files → edge ids.
  // Emit an empty delta so the client falls back to its own heuristic
  // (deltaFromFileChanges) when it has the current edge set. This is the
  // "document it and ship" path from the task brief: the plugin returns
  // a well-formed but empty CommitDelta.
  if (filesChanged.length === 0) return { sha, added: [], removed: [] };
  // As a placeholder, emit synthetic `file:<path>` edge ids so the
  // film-strip still shows motion during development.
  const added: string[] = [];
  const removed: string[] = [];
  for (const f of filesChanged) {
    const id = `file:${f}`;
    if (hashBucket(`${sha}:${f}`) === 0) added.push(id);
    else removed.push(id);
  }
  return { sha, added, removed };
}

// ── Plugin ──────────────────────────────────────────────────────────

async function isGitRepo(repoPath: string): Promise<boolean> {
  try {
    await exec("git", ["rev-parse", "--git-dir"], {
      cwd: repoPath,
      timeoutMs: 5000,
    });
    return true;
  } catch {
    return false;
  }
}

function sendJson(
  res: { statusCode?: number; setHeader: (k: string, v: string) => void; end: (b?: string) => void },
  status: number,
  body: unknown,
): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

export interface GitHistoryPluginOptions {
  /**
   * Optional fallback repo path. When the `repo` query param is missing,
   * endpoints use this. Defaults to Vite's `process.cwd()` at config time.
   */
  defaultRepoPath?: string;
}

export function gitHistoryPlugin(options: GitHistoryPluginOptions = {}): Plugin {
  const defaultRepoPath = options.defaultRepoPath ?? process.cwd();

  return {
    name: "quanta:git-history",
    configureServer(server) {
      // /__git/log — list commits, merging cache + fresh pulls.
      server.middlewares.use("/__git/log", (req, res) => {
        void (async () => {
          const url = new URL(req.url ?? "", "http://localhost");
          const repoPath = url.searchParams.get("repo") ?? defaultRepoPath;
          const limit = Math.min(
            Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT),
            MAX_CACHED_COMMITS,
          );
          const since = url.searchParams.get("since");
          const sinceMs = since ? Number(since) : undefined;

          if (!(await isGitRepo(repoPath))) {
            sendJson(res, 503, { error: "not a git repo", repoPath, commits: [] });
            return;
          }

          const repoKey = repoKeyFor(repoPath);
          const cached = await readCachedCommits(repoKey);
          const newestCached = cached[0]?.timestamp ?? 0;

          try {
            // Pull only commits newer than cache's most recent. If cache
            // is empty, respect the caller's `since` or pull up to limit.
            const effectiveSince = Math.max(
              newestCached,
              Number.isFinite(sinceMs) ? (sinceMs as number) : 0,
            );
            const fresh = await gitLog(repoPath, limit, effectiveSince || undefined);
            // Merge — fresh is newest-first; cache may overlap on the
            // boundary commit. Dedup by sha, keeping fresh version.
            const seen = new Set<string>();
            const merged: CommitMeta[] = [];
            for (const c of fresh) {
              if (seen.has(c.sha)) continue;
              seen.add(c.sha);
              merged.push(c);
            }
            for (const c of cached) {
              if (seen.has(c.sha)) continue;
              seen.add(c.sha);
              merged.push(c);
            }
            merged.sort((a, b) => b.timestamp - a.timestamp);

            // Persist (fire-and-forget — don't block the response).
            void writeCachedCommits(repoKey, merged);

            let out = merged;
            if (Number.isFinite(sinceMs)) out = out.filter(c => c.timestamp >= (sinceMs as number));
            if (limit > 0) out = out.slice(0, limit);

            sendJson(res, 200, { commits: out, fromCache: cached.length, freshFetched: fresh.length });
          } catch (err) {
            // On failure, return whatever's cached so the UI still has data.
            // eslint-disable-next-line no-console
            console.warn(`[git-history] log failed: ${String(err)}`);
            let out = cached;
            if (Number.isFinite(sinceMs)) out = out.filter(c => c.timestamp >= (sinceMs as number));
            if (limit > 0) out = out.slice(0, limit);
            sendJson(res, 200, { commits: out, fromCache: cached.length, error: String(err) });
          }
        })();
      });

      // /__git/delta/<sha> — per-commit delta. We synthesize a plausible
      // add/remove based on `git diff --name-only`.
      server.middlewares.use("/__git/delta", (req, res) => {
        void (async () => {
          const url = new URL(req.url ?? "", "http://localhost");
          // Pathname after the mount is `/<sha>` (connect strips the mount).
          const sha = url.pathname.replace(/^\/+/, "").split("/")[0];
          if (!sha || !/^[0-9a-f]{4,40}$/i.test(sha)) {
            sendJson(res, 400, { error: "invalid sha" });
            return;
          }
          const repoPath = url.searchParams.get("repo") ?? defaultRepoPath;
          if (!(await isGitRepo(repoPath))) {
            sendJson(res, 503, { error: "not a git repo", sha, added: [], removed: [] });
            return;
          }
          try {
            const files = await gitDeltaFiles(repoPath, sha);
            const delta = synthesizeDelta(sha, files);
            sendJson(res, 200, delta);
          } catch (err) {
            sendJson(res, 200, { sha, added: [], removed: [], error: String(err) });
          }
        })();
      });
    },
  };
}
