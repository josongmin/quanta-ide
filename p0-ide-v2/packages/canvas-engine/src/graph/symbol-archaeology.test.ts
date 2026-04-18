import { describe, it, expect } from "vitest";
import { findSymbolFirstAppearance } from "./symbol-archaeology";
import type { FileEdge } from "./types";
import type { GraphHistory } from "./history";

function mkEdge(id: string, from: string, to: string, opts: Partial<FileEdge> = {}): FileEdge {
  return {
    id,
    from,
    to,
    kind: "call",
    layer: "structural",
    weight: 1,
    ...opts,
  };
}

describe("findSymbolFirstAppearance", () => {
  it("returns the first snapshot that exposes fromSymbol at the file", () => {
    const e1 = mkEdge("e1", "svc/foo.ts", "svc/bar.ts", { fromSymbol: "bootstrap" });
    const e2 = mkEdge("e2", "svc/foo.ts", "svc/baz.ts", { fromSymbol: "bootstrap" });
    const edgeIndex = new Map([e1, e2].map(e => [e.id, e]));

    const history: GraphHistory = {
      snapshots: [
        { timestamp: 100, label: "initial", commitSha: "sha1", edgeIds: [] },
        { timestamp: 200, label: "add bootstrap", commitSha: "sha2", added: [e1.id] },
        { timestamp: 300, label: "second use", commitSha: "sha3", added: [e2.id] },
      ],
    };

    const out = findSymbolFirstAppearance("bootstrap", "svc/foo.ts", history, edgeIndex);
    expect(out).not.toBeNull();
    expect(out?.firstSeenSha).toBe("sha2");
    expect(out?.firstSeenTimestamp).toBe(200);
    expect(out?.commitMessage).toBe("add bootstrap");
  });

  it("matches toSymbol at the file too", () => {
    const e1 = mkEdge("e1", "a.ts", "b.ts", { toSymbol: "Target" });
    const edgeIndex = new Map([[e1.id, e1]]);
    const history: GraphHistory = {
      snapshots: [
        { timestamp: 1, label: "s1", commitSha: "only", edgeIds: [e1.id] },
      ],
    };
    const out = findSymbolFirstAppearance("Target", "b.ts", history, edgeIndex);
    expect(out?.firstSeenSha).toBe("only");
  });

  it("returns null when the symbol never appears", () => {
    const e1 = mkEdge("e1", "a.ts", "b.ts", { fromSymbol: "other" });
    const edgeIndex = new Map([[e1.id, e1]]);
    const history: GraphHistory = {
      snapshots: [
        { timestamp: 1, label: "s1", commitSha: "sha", edgeIds: [e1.id] },
      ],
    };
    expect(findSymbolFirstAppearance("missing", "a.ts", history, edgeIndex)).toBeNull();
  });

  it("returns null when history is empty", () => {
    expect(
      findSymbolFirstAppearance("x", "a.ts", { snapshots: [] }, new Map()),
    ).toBeNull();
  });
});
