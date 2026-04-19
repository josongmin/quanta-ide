import { describe, it, expect, vi } from "vitest";
import { GitHistorySource, deltaFromFileChanges } from "./git-history-source";
import type { CommitMeta, CommitDelta } from "./history-source";
import type { FileEdge } from "./types";

function jsonResponse(body: unknown, ok = true): Response {
  return new Response(JSON.stringify(body), {
    status: ok ? 200 : 500,
    headers: { "Content-Type": "application/json" },
  });
}

const COMMITS: CommitMeta[] = [
  {
    sha: "cccccccccccccccccccccccccccccccccccccccc",
    shortSha: "ccccccc",
    timestamp: 3000,
    author: "alice",
    message: "add d",
    filesChanged: ["d.ts"],
    additions: 4,
    deletions: 0,
    parentShas: ["bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"],
  },
  {
    sha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    shortSha: "bbbbbbb",
    timestamp: 2000,
    author: "bob",
    message: "link c",
    filesChanged: ["c.ts"],
    additions: 3,
    deletions: 1,
    parentShas: ["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
  },
  {
    sha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    shortSha: "aaaaaaa",
    timestamp: 1000,
    author: "charlie",
    message: "init",
    filesChanged: ["a.ts", "b.ts"],
    additions: 10,
    deletions: 0,
    parentShas: [],
  },
];

const DELTAS: Record<string, CommitDelta> = {
  aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa: {
    sha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    added: ["e1", "e2"],
    removed: [],
  },
  bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb: {
    sha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    added: ["e3"],
    removed: [],
  },
  cccccccccccccccccccccccccccccccccccccccc: {
    sha: "cccccccccccccccccccccccccccccccccccccccc",
    added: ["e4"],
    removed: ["e1"],
  },
};

function makeFetch() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/__git/log")) return jsonResponse({ commits: COMMITS });
    const match = url.match(/\/__git\/delta\/([^/?]+)/);
    if (match) {
      const sha = decodeURIComponent(match[1]);
      return jsonResponse(DELTAS[sha] ?? { sha, added: [], removed: [] });
    }
    return jsonResponse({}, false);
  });
}

describe("GitHistorySource", () => {
  it("listCommits returns normalized commits newest-first", async () => {
    const fetchImpl = makeFetch();
    const src = new GitHistorySource({ fetchImpl: fetchImpl as unknown as typeof fetch });
    const commits = await src.listCommits();
    expect(commits.map(c => c.sha)).toEqual(COMMITS.map(c => c.sha));
    // Network hit only once even if asked twice.
    await src.listCommits();
    const logHits = fetchImpl.mock.calls.filter(c => String(c[0]).includes("/__git/log"));
    expect(logHits.length).toBe(1);
  });

  it("listCommits applies limit + since", async () => {
    const fetchImpl = makeFetch();
    const src = new GitHistorySource({ fetchImpl: fetchImpl as unknown as typeof fetch });
    const limited = await src.listCommits({ limit: 2 });
    expect(limited.length).toBe(2);
    const since2000 = await src.listCommits({ since: 2000 });
    expect(since2000.map(c => c.sha)).toEqual([COMMITS[0].sha, COMMITS[1].sha]);
  });

  it("deltaAt is memoized per sha", async () => {
    const fetchImpl = makeFetch();
    const src = new GitHistorySource({ fetchImpl: fetchImpl as unknown as typeof fetch });
    await src.deltaAt(COMMITS[0].sha);
    await src.deltaAt(COMMITS[0].sha);
    const deltaHits = fetchImpl.mock.calls.filter(c => String(c[0]).includes("/__git/delta/"));
    expect(deltaHits.length).toBe(1);
  });

  it("edgeSetAt replays deltas from root forward", async () => {
    const fetchImpl = makeFetch();
    const src = new GitHistorySource({ fetchImpl: fetchImpl as unknown as typeof fetch });
    // Newest commit: e1 removed, so absolute set should be {e2, e3, e4}.
    const newest = await src.edgeSetAt(COMMITS[0].sha);
    expect([...newest].sort()).toEqual(["e2", "e3", "e4"]);
    // Middle commit: {e1, e2, e3}.
    const mid = await src.edgeSetAt(COMMITS[1].sha);
    expect([...mid].sort()).toEqual(["e1", "e2", "e3"]);
    // Root: {e1, e2}.
    const root = await src.edgeSetAt(COMMITS[2].sha);
    expect([...root].sort()).toEqual(["e1", "e2"]);
  });

  it("edgeSetAt on unknown sha returns empty set", async () => {
    const fetchImpl = makeFetch();
    const src = new GitHistorySource({ fetchImpl: fetchImpl as unknown as typeof fetch });
    const set = await src.edgeSetAt("nope");
    expect(set.size).toBe(0);
  });

  it("listCommits tolerates 5xx and returns empty", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, false));
    const src = new GitHistorySource({ fetchImpl: fetchImpl as unknown as typeof fetch });
    const commits = await src.listCommits();
    expect(commits.length).toBe(0);
  });

  it("throws if no fetch impl is available", () => {
    const original = (globalThis as { fetch?: typeof fetch }).fetch;
    (globalThis as { fetch?: typeof fetch }).fetch = undefined;
    try {
      expect(() => new GitHistorySource()).toThrow(/fetch/);
    } finally {
      if (original) (globalThis as { fetch?: typeof fetch }).fetch = original;
      else delete (globalThis as { fetch?: typeof fetch }).fetch;
    }
  });
});

describe("deltaFromFileChanges", () => {
  const EDGES: readonly FileEdge[] = [
    { id: "a->b", from: "a.ts", to: "b.ts", kind: "import", layer: "structural", weight: 1 },
    { id: "a->c", from: "a.ts", to: "c.ts", kind: "import", layer: "structural", weight: 1 },
    { id: "x->y", from: "x.ts", to: "y.ts", kind: "import", layer: "structural", weight: 1 },
  ];

  it("only considers edges touching changed files", () => {
    const delta = deltaFromFileChanges("deadbeef", ["a.ts"], EDGES);
    const touched = new Set([...delta.added, ...delta.removed]);
    expect(touched.has("a->b")).toBe(true);
    expect(touched.has("a->c")).toBe(true);
    expect(touched.has("x->y")).toBe(false);
  });

  it("is deterministic for a given (sha, edges, files) tuple", () => {
    const a = deltaFromFileChanges("abc", ["a.ts", "b.ts"], EDGES);
    const b = deltaFromFileChanges("abc", ["a.ts", "b.ts"], EDGES);
    expect(a).toEqual(b);
  });

  it("returns empty delta when no files changed", () => {
    const delta = deltaFromFileChanges("x", [], EDGES);
    expect(delta.added.length).toBe(0);
    expect(delta.removed.length).toBe(0);
  });
});
