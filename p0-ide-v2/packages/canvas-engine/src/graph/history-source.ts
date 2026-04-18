// HistorySource — abstraction over a time-ordered commit stream.
//
// Motivation: the canvas temporal UI (film strip + dual-split) needs to
// scrub through commits and diff edge sets across them. We want the same
// UI to work against (a) a synthesized mock history for demos/tests and
// (b) real `git log` output served from the dev server. Introducing an
// interface lets us swap sources at runtime (feature-gated) without the
// consumer knowing which is which.
//
// Shapes in this file are the authoritative contract:
//   - `CommitMeta`   — enough to render a commit row / film-strip tick.
//   - `CommitDelta`  — per-commit edge delta; absolute sets are derived
//                      by walking deltas forward from the root.
//   - `HistorySource` — the methods the UI calls.
//
// Sources should:
//   - Return commits newest-first (callers paginate as needed).
//   - Keep `id` stable across queries so React + memoization can treat it
//     as a dependency key when the source swaps.
//   - Be safe to call concurrently (internal caching / memoization is
//     the source's responsibility, not the caller's).

export interface CommitMeta {
  sha: string;
  shortSha: string;
  /** Epoch ms — committer date. */
  timestamp: number;
  author: string;
  authorEmail?: string;
  /** Subject line only (no body). */
  message: string;
  filesChanged: readonly string[];
  additions: number;
  deletions: number;
  /** `[]` for root, `[x]` for normal, `[x, y]` for merge. */
  parentShas: readonly string[];
}

export interface CommitDelta {
  sha: string;
  /** Edge ids introduced at this commit relative to its parent. */
  added: readonly string[];
  /** Edge ids removed at this commit relative to its parent. */
  removed: readonly string[];
}

export interface HistorySourceListOpts {
  /** Hard cap on number of commits returned (newest-first). */
  limit?: number;
  /** Epoch ms — drop commits older than this. */
  since?: number;
}

export interface HistorySource {
  /**
   * List commits newest-first, bounded by `limit`.
   * Sources SHOULD cache across calls so repeat invocations are cheap.
   */
  listCommits(opts?: HistorySourceListOpts): Promise<readonly CommitMeta[]>;

  /**
   * Return the absolute edge-id set at `sha`. Most implementations
   * compute this by replaying deltas from the root; callers should
   * treat this as potentially O(commits).
   */
  edgeSetAt(sha: string): Promise<ReadonlySet<string>>;

  /**
   * Return the per-commit delta. Unknown shas yield an empty delta
   * rather than throwing — temporal UIs poke at the bounds often.
   */
  deltaAt(sha: string): Promise<CommitDelta>;

  /**
   * Stable identity — used as a dependency key for memoization and
   * to tell the two sources apart at the UI layer.
   */
  readonly id: string;
}

/** Empty delta helper so sources can short-circuit unknown shas uniformly. */
export function emptyDelta(sha: string): CommitDelta {
  return { sha, added: EMPTY_ARRAY, removed: EMPTY_ARRAY };
}

const EMPTY_ARRAY: readonly string[] = [];
