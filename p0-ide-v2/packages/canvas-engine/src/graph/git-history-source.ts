// GitHistorySource — browser-side client for the dev-server git plugin.
//
// Hits two endpoints exposed by `vite-plugins/git-history-plugin.ts`:
//   GET /__git/log?limit=200&since=<ts>   → CommitMeta[]
//   GET /__git/delta/<sha>                → CommitDelta
//
// The plugin handles shelling out to `git`, caches results to an NDJSON
// file under the user's home, and is a no-op when `git` isn't available
// (endpoints respond 503 and we fall back to an empty commit list).
//
// All network calls are memoized in-process so repeated UI panels don't
// hammer the endpoint. `edgeSetAt` is computed by walking deltas from
// the oldest known commit forward — sources are expected to be roughly
// linear (we don't attempt merge-aware replay; for the temporal slider
// that's fine).

import type { FileEdge } from "./types";
import type {
  CommitDelta,
  CommitMeta,
  HistorySource,
  HistorySourceListOpts,
} from "./history-source";
import { emptyDelta } from "./history-source";

export interface GitHistorySourceOptions {
  /** Override fetch URL prefix (defaults to same-origin `/`). */
  baseUrl?: string;
  /** Repo key — echoed into the URL for server-side cache partitioning. */
  repoKey?: string;
  /** Override the source id (useful in tests). */
  id?: string;
  /** Inject a fetch impl — tests wire a fake; prod uses global fetch. */
  fetchImpl?: typeof fetch;
}

/**
 * Factory for a git-backed HistorySource. Prefer this over constructing
 * the class directly: the class is not exported from the `@quanta/canvas-engine`
 * barrel, so consumers only see the `HistorySource` interface.
 */
export function createGitHistorySource(
  opts: GitHistorySourceOptions = {},
): HistorySource {
  return new GitHistorySource(opts);
}

// WHY: same sealing rationale as MockHistorySource — class is `export`ed
// here so sibling tests can instantiate it, but NOT re-exported from the
// package barrel. Production callers route through `createGitHistorySource`.
export class GitHistorySource implements HistorySource {
  readonly id: string;
  private readonly baseUrl: string;
  private readonly repoKey?: string;
  private readonly fetchImpl: typeof fetch;
  private commitsPromise: Promise<readonly CommitMeta[]> | null = null;
  private readonly deltaCache: Map<string, Promise<CommitDelta>> = new Map();
  private readonly absoluteCache: Map<string, ReadonlySet<string>> = new Map();

  constructor(opts: GitHistorySourceOptions = {}) {
    this.id = opts.id ?? (opts.repoKey ? `git:${opts.repoKey}` : "git");
    this.baseUrl = opts.baseUrl ?? "";
    this.repoKey = opts.repoKey;
    // Allow a test double; otherwise grab whatever `fetch` is on the
    // current realm. Lazily bind so Node environments without fetch
    // can still instantiate the class for tests that stub fetchImpl.
    const rawFetch = opts.fetchImpl
      ?? (typeof fetch !== "undefined" ? fetch : undefined);
    if (!rawFetch) {
      throw new Error("GitHistorySource: no fetch impl available");
    }
    // Bind so `this` doesn't leak into global fetch. Cast safe: rawFetch
    // satisfies `typeof fetch` at construction time.
    this.fetchImpl = rawFetch.bind(globalThis) as typeof fetch;
  }

  async listCommits(opts: HistorySourceListOpts = {}): Promise<readonly CommitMeta[]> {
    if (!this.commitsPromise) {
      this.commitsPromise = this.fetchCommits();
    }
    let commits = await this.commitsPromise;
    if (typeof opts.since === "number") {
      commits = commits.filter(c => c.timestamp >= opts.since!);
    }
    if (typeof opts.limit === "number" && opts.limit >= 0) {
      commits = commits.slice(0, opts.limit);
    }
    return commits;
  }

  async edgeSetAt(sha: string): Promise<ReadonlySet<string>> {
    const cached = this.absoluteCache.get(sha);
    if (cached) return cached;
    const commits = await this.listCommits();
    // Replay deltas from the oldest known commit forward up to `sha`.
    // Commits returned by the plugin are newest-first; iterate in
    // reverse so the root is first.
    const idx = commits.findIndex(c => c.sha === sha);
    if (idx < 0) return EMPTY_SET;
    // Commits are newest-first, so "root through target" is the slice
    // from `idx` to the end, reversed. Root lives at the end (oldest),
    // target at `idx`.
    const chronological = commits.slice(idx).reverse();
    const acc = new Set<string>();
    for (const c of chronological) {
      const delta = await this.deltaAt(c.sha);
      for (const id of delta.added) acc.add(id);
      for (const id of delta.removed) acc.delete(id);
    }
    const frozen: ReadonlySet<string> = acc;
    this.absoluteCache.set(sha, frozen);
    return frozen;
  }

  async deltaAt(sha: string): Promise<CommitDelta> {
    let pending = this.deltaCache.get(sha);
    if (!pending) {
      pending = this.fetchDelta(sha);
      this.deltaCache.set(sha, pending);
    }
    return pending;
  }

  private async fetchCommits(): Promise<readonly CommitMeta[]> {
    const url = this.url("/__git/log", { limit: "500" });
    try {
      const res = await this.fetchImpl(url);
      if (!res.ok) return EMPTY_COMMITS;
      const body = (await res.json()) as { commits?: CommitMeta[] } | CommitMeta[];
      const arr = Array.isArray(body) ? body : body.commits ?? [];
      return normaliseCommits(arr);
    } catch {
      return EMPTY_COMMITS;
    }
  }

  private async fetchDelta(sha: string): Promise<CommitDelta> {
    const url = this.url(`/__git/delta/${encodeURIComponent(sha)}`);
    try {
      const res = await this.fetchImpl(url);
      if (!res.ok) return emptyDelta(sha);
      const body = (await res.json()) as Partial<CommitDelta>;
      return {
        sha,
        added: Array.isArray(body.added) ? body.added.filter(isString) : [],
        removed: Array.isArray(body.removed) ? body.removed.filter(isString) : [],
      };
    } catch {
      return emptyDelta(sha);
    }
  }

  private url(path: string, query: Record<string, string> = {}): string {
    const qs = new URLSearchParams(query);
    if (this.repoKey) qs.set("repo", this.repoKey);
    const search = qs.toString();
    return `${this.baseUrl}${path}${search ? `?${search}` : ""}`;
  }
}

/**
 * Given an edge list + a commit's list of touched files, synthesize a
 * CommitDelta by flagging every edge whose `from` or `to` appears in the
 * touched set as changed. This is a deliberate approximation — real edge
 * deltas require AST-diff, which lives in a later slice. The heuristic
 * is good enough for the film strip to show motion.
 *
 * Exported so the vite plugin can share exactly the same logic as tests
 * when it needs to synthesize deltas from `git diff --name-only` output.
 */
export function deltaFromFileChanges(
  sha: string,
  filesChanged: readonly string[],
  edges: readonly FileEdge[],
): CommitDelta {
  if (filesChanged.length === 0 || edges.length === 0) return emptyDelta(sha);
  const touched = new Set(filesChanged);
  // 50/50 split the touched edges into added vs removed, using a hash
  // of edge id so the split is deterministic across calls. Production
  // will replace this with real per-commit structural diff.
  const added: string[] = [];
  const removed: string[] = [];
  for (const edge of edges) {
    if (!touched.has(edge.from) && !touched.has(edge.to)) continue;
    const bucket = hashToBucket(`${sha}:${edge.id}`);
    if (bucket === 0) added.push(edge.id);
    else removed.push(edge.id);
  }
  return { sha, added, removed };
}

function hashToBucket(s: string): 0 | 1 {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h & 1) as 0 | 1;
}

function isString(v: unknown): v is string {
  return typeof v === "string";
}

function normaliseCommits(raw: readonly unknown[]): readonly CommitMeta[] {
  const out: CommitMeta[] = [];
  for (const v of raw) {
    if (!v || typeof v !== "object") continue;
    const c = v as Record<string, unknown>;
    const sha = typeof c.sha === "string" ? c.sha : null;
    const timestamp = typeof c.timestamp === "number" ? c.timestamp : null;
    const author = typeof c.author === "string" ? c.author : null;
    const message = typeof c.message === "string" ? c.message : null;
    if (!sha || timestamp == null || author == null || message == null) continue;
    out.push({
      sha,
      shortSha: typeof c.shortSha === "string" ? c.shortSha : sha.slice(0, 7),
      timestamp,
      author,
      authorEmail: typeof c.authorEmail === "string" ? c.authorEmail : undefined,
      message,
      filesChanged: Array.isArray(c.filesChanged) ? c.filesChanged.filter(isString) : [],
      additions: typeof c.additions === "number" ? c.additions : 0,
      deletions: typeof c.deletions === "number" ? c.deletions : 0,
      parentShas: Array.isArray(c.parentShas) ? c.parentShas.filter(isString) : [],
    });
  }
  return out;
}

const EMPTY_SET: ReadonlySet<string> = new Set<string>();
const EMPTY_COMMITS: readonly CommitMeta[] = [];
