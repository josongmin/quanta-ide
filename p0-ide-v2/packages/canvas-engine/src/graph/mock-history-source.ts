// MockHistorySource — wraps the existing synthesized `GraphHistory` so
// the film-strip / diff / time-travel UI can run against a deterministic
// 5-snapshot dataset without a real git repo.
//
// It takes a `GraphHistory` (typically from sample-graph) plus the full
// set of file edges (used to infer plausible commit messages from the
// files that changed). Commit metas are fabricated by cycling a fixed
// author roster so dev reloads don't shuffle the film strip.

import type { GraphHistory, GraphSnapshot } from "./history";
import { materializeEdgeSet } from "./history";
import type { FileEdge } from "./types";
import type {
  CommitDelta,
  CommitMeta,
  HistorySource,
  HistorySourceListOpts,
} from "./history-source";
import { emptyDelta } from "./history-source";

const AUTHORS: readonly { name: string; email: string }[] = [
  { name: "alice",   email: "alice@quanta.dev"   },
  { name: "bob",     email: "bob@quanta.dev"     },
  { name: "charlie", email: "charlie@quanta.dev" },
  { name: "dana",    email: "dana@quanta.dev"    },
];

function shortShaFor(index: number, timestamp: number): string {
  // Deterministic 7-char hex — mixes index and timestamp so shas differ
  // across snapshots. We don't try to mimic git's content hashing; we
  // only need identity within the mock session.
  const n = (index * 2654435761) ^ (timestamp | 0);
  return (n >>> 0).toString(16).padStart(8, "0").slice(0, 7);
}

function longShaFor(index: number, timestamp: number): string {
  const head = shortShaFor(index, timestamp);
  // Pad out to a plausible 40-char SHA by hashing further. Still purely
  // deterministic and collision-resistant enough within N <= 50 commits.
  let acc = (index + 1) * 2246822519;
  const parts: string[] = [head];
  for (let i = 0; i < 5; i++) {
    acc = (acc ^ (acc << 13)) >>> 0;
    acc = (acc ^ (acc >>> 17)) >>> 0;
    acc = (acc ^ (acc << 5)) >>> 0;
    parts.push((acc >>> 0).toString(16).padStart(8, "0"));
  }
  return parts.join("").slice(0, 40);
}

// Build a plausible subject line from the files whose edges were added
// or removed. Tiny heuristic: if exactly one file is touched, refer to
// it by basename; otherwise summarize by count. Final fallback is the
// snapshot's label so the UI always has something human-readable.
function synthesizeMessage(
  snap: GraphSnapshot,
  filesTouched: readonly string[],
): string {
  if (filesTouched.length === 1) {
    const base = filesTouched[0].split("/").pop() ?? filesTouched[0];
    return `refactor: ${base}`;
  }
  if (filesTouched.length > 1) {
    return `refactor: touch ${filesTouched.length} files`;
  }
  return snap.label || "chore: no-op";
}

function filesTouchedInDelta(
  deltaIds: readonly string[],
  edgeById: ReadonlyMap<string, FileEdge>,
): string[] {
  const set = new Set<string>();
  for (const id of deltaIds) {
    const edge = edgeById.get(id);
    if (!edge) continue;
    set.add(edge.from);
    set.add(edge.to);
  }
  return [...set];
}

export interface MockHistorySourceOptions {
  /** Override the derived source id (useful in tests). */
  id?: string;
}

/**
 * Factory for a mock HistorySource. Prefer this over constructing the
 * class directly: the concrete implementation is intentionally not part
 * of the `@quanta/canvas-engine` barrel, so consumers stay insulated
 * from its shape and we're free to rework internals without breaking them.
 */
export function createMockHistorySource(
  history: GraphHistory,
  edges: readonly FileEdge[],
  opts: MockHistorySourceOptions = {},
): HistorySource {
  return new MockHistorySource(history, edges, opts);
}

// WHY: the class remains `export`ed from this module so sibling tests can
// instantiate it directly, but the package barrel (`@quanta/canvas-engine`)
// does NOT re-export it. External callers must use `createMockHistorySource`
// so we can swap internals without breaking them.
export class MockHistorySource implements HistorySource {
  readonly id: string;
  private readonly history: GraphHistory;
  private readonly metas: readonly CommitMeta[];
  private readonly deltas: ReadonlyMap<string, CommitDelta>;
  private readonly absoluteBySha: Map<string, ReadonlySet<string>> = new Map();

  constructor(
    history: GraphHistory,
    edges: readonly FileEdge[],
    opts: MockHistorySourceOptions = {},
  ) {
    this.history = history;
    this.id = opts.id ?? "mock";
    const edgeById = new Map<string, FileEdge>();
    for (const e of edges) edgeById.set(e.id, e);

    // Build metas in chronological order (oldest → newest) so parent
    // SHAs can reference the prior commit. `listCommits` reverses.
    const snaps = history.snapshots;
    const metas: CommitMeta[] = [];
    const deltaMap = new Map<string, CommitDelta>();
    let prevSha: string | null = null;

    for (let i = 0; i < snaps.length; i++) {
      const snap = snaps[i];
      // Prefer the snapshot's own commit sha when present so film-strip
      // picks and PR replay can round-trip through deep-link URLs. Fall
      // back to the deterministic hash so legacy histories (pre-T1 upgrade)
      // still produce a unique sha.
      const sha = snap.commitSha ?? longShaFor(i, snap.timestamp);
      const shortSha = sha.slice(0, 7);
      // Derive a delta — prefer the snapshot's declared add/remove; when
      // a snapshot ships an absolute edgeIds (as the base does) we treat
      // the diff against an empty set as the "added" side. The UI never
      // calls deltaAt on the base in practice, but keep it well-formed.
      const added: readonly string[] = snap.added ?? snap.edgeIds ?? [];
      const removed: readonly string[] = snap.removed ?? [];
      const delta: CommitDelta = { sha, added, removed };
      deltaMap.set(sha, delta);

      const filesTouched = filesTouchedInDelta([...added, ...removed], edgeById);
      // Prefer per-snapshot author metadata when the snapshot carries it
      // (richer synthesized histories + real git sources set this). Fall
      // back to the deterministic roster cycle so tests keep their
      // existing alice→bob→charlie→dana assumption.
      const rosterAuthor = AUTHORS[i % AUTHORS.length];
      const authorName = snap.author ?? rosterAuthor.name;
      const authorEmail = snap.authorEmail
        ?? (snap.author ? `${snap.author}@quanta.dev` : rosterAuthor.email);
      const meta: CommitMeta = {
        sha,
        shortSha,
        timestamp: snap.timestamp,
        author: authorName,
        authorEmail,
        message: snap.message ?? synthesizeMessage(snap, filesTouched),
        filesChanged: filesTouched,
        // Edges aren't lines, but additions/deletions must be non-trivial
        // for the UI's bar chart. Use delta sizes as a proxy × a small
        // fudge factor so the film strip has visible variance.
        additions: snap.additions ?? added.length * 7,
        deletions: snap.deletions ?? removed.length * 5,
        parentShas: prevSha ? [prevSha] : [],
      };
      metas.push(meta);
      prevSha = sha;
    }

    // Freeze metas newest-first so `listCommits` can slice without
    // allocating a reversed copy on every call.
    this.metas = metas.slice().reverse();
    this.deltas = deltaMap;
  }

  async listCommits(opts: HistorySourceListOpts = {}): Promise<readonly CommitMeta[]> {
    let out: readonly CommitMeta[] = this.metas;
    if (typeof opts.since === "number") {
      out = out.filter(m => m.timestamp >= opts.since!);
    }
    if (typeof opts.limit === "number" && opts.limit >= 0) {
      out = out.slice(0, opts.limit);
    }
    return out;
  }

  async edgeSetAt(sha: string): Promise<ReadonlySet<string>> {
    const cached = this.absoluteBySha.get(sha);
    if (cached) return cached;
    // Find the snapshot index for this sha. Index is encoded in insertion
    // order: metas are newest-first, so we map sha → original index.
    const idx = this.snapshotIndexForSha(sha);
    if (idx < 0) return EMPTY_SET;
    const set = materializeEdgeSet(this.history, idx);
    this.absoluteBySha.set(sha, set);
    return set;
  }

  async deltaAt(sha: string): Promise<CommitDelta> {
    return this.deltas.get(sha) ?? emptyDelta(sha);
  }

  private snapshotIndexForSha(sha: string): number {
    // Metas are ordered newest-first; their index in the ORIGINAL
    // snapshot array is (snapshots.length - 1 - metasIndex).
    for (let i = 0; i < this.metas.length; i++) {
      if (this.metas[i].sha === sha) {
        return this.history.snapshots.length - 1 - i;
      }
    }
    return -1;
  }
}

const EMPTY_SET: ReadonlySet<string> = new Set<string>();
