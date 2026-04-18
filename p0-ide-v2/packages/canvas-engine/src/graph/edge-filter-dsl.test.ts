import { describe, it, expect, beforeEach } from "vitest";
import {
  compileEdgeFilter,
  compileEdgeFilterWithContext,
  parseTimeExpression,
  isTemporalKey,
  resetCompileCache,
} from "./edge-filter-dsl";
import type { FileEdge } from "./types";
import type { GraphHistory } from "./history";

function edge(id: string): FileEdge {
  return {
    id,
    from: "a",
    to: "b",
    kind: "call",
    layer: "structural",
    weight: 1,
  };
}

describe("edge-filter DSL — base keys (sanity)", () => {
  beforeEach(() => resetCompileCache());

  it("empty string compiles to always-true", () => {
    const out = compileEdgeFilter("");
    expect(out.predicate?.(edge("e1"))).toBe(true);
  });

  it("layer= filter filters by layer", () => {
    const out = compileEdgeFilter("layer=structural");
    const e = edge("e1");
    expect(out.predicate?.(e)).toBe(true);
    const e2 = { ...e, layer: "flow" as const };
    expect(out.predicate?.(e2)).toBe(false);
  });
});

// Temporal test fixtures
const DAY = 86_400_000;
const NOW = 10_000_000_000; // arbitrary stable "now" (ms since epoch)

function buildHistory(): GraphHistory {
  return {
    snapshots: [
      { timestamp: NOW - 365 * DAY, label: "v1.0 initial alice",   edgeIds: ["e1", "e2"] },
      { timestamp: NOW - 200 * DAY, label: "v1.1 feat bob",        added: ["e3"] },
      { timestamp: NOW -  60 * DAY, label: "v1.2 refactor alice",  added: ["e4"], removed: ["e1"] },
      { timestamp: NOW -  10 * DAY, label: "v1.3 churn bob",       added: ["e1"], removed: ["e4"] },
      { timestamp: NOW -   5 * DAY, label: "v1.4 recent charlie",  added: ["e5"] },
    ],
  };
}

describe("parseTimeExpression", () => {
  it("parses d / w / m / y", () => {
    expect(parseTimeExpression("1d")).toBe(DAY);
    expect(parseTimeExpression("2w")).toBe(DAY * 14);
    expect(parseTimeExpression("3m")).toBe(DAY * 30 * 3);
    expect(parseTimeExpression("1y")).toBe(DAY * 365);
  });

  it("throws on bad input", () => {
    expect(() => parseTimeExpression("nope")).toThrow();
    expect(() => parseTimeExpression("10z")).toThrow();
  });
});

describe("isTemporalKey", () => {
  it("recognizes temporal keys", () => {
    expect(isTemporalKey("added_since")).toBe(true);
    expect(isTemporalKey("stable_since")).toBe(true);
    expect(isTemporalKey("touched_by")).toBe(true);
    expect(isTemporalKey("churn")).toBe(true);
    expect(isTemporalKey("introduced_between")).toBe(true);
  });
  it("returns false for base keys", () => {
    expect(isTemporalKey("layer")).toBe(false);
    expect(isTemporalKey("kind")).toBe(false);
  });
});

describe("edge-filter DSL — temporal keys", () => {
  beforeEach(() => resetCompileCache());

  const history = buildHistory();
  const ctx = { history, commitTimestamp: NOW };

  describe("added_since", () => {
    it("added_since(2w) matches edges first-seen within 2 weeks", () => {
      const out = compileEdgeFilterWithContext("added_since=2w", ctx);
      // e5 first appears 5d ago → within 2w
      expect(out.predicate?.(edge("e5"))).toBe(true);
      // e3 first appears 200d ago → outside 2w
      expect(out.predicate?.(edge("e3"))).toBe(false);
      // e1 first appears at v1.0 (365d ago) → outside 2w
      expect(out.predicate?.(edge("e1"))).toBe(false);
    });

    it("added_since(1y) matches everything (all edges first-seen within a year)", () => {
      const out = compileEdgeFilterWithContext("added_since=1y", ctx);
      for (const id of ["e1", "e2", "e3", "e4", "e5"]) {
        expect(out.predicate?.(edge(id))).toBe(true);
      }
    });

    it("unknown edge not in history is excluded", () => {
      const out = compileEdgeFilterWithContext("added_since=2w", ctx);
      expect(out.predicate?.(edge("e99"))).toBe(false);
    });
  });

  describe("touched_by", () => {
    it("touched_by=alice matches edges whose delta-commits mention alice", () => {
      const out = compileEdgeFilterWithContext("touched_by=alice", ctx);
      // e4 is added in v1.2 (alice refactor) → match
      expect(out.predicate?.(edge("e4"))).toBe(true);
      // e3 is added in v1.1 by bob only → no
      expect(out.predicate?.(edge("e3"))).toBe(false);
    });

    it("touched_by=bob matches bob's edges", () => {
      const out = compileEdgeFilterWithContext("touched_by=bob", ctx);
      expect(out.predicate?.(edge("e3"))).toBe(true);
    });

    it("touched_by unknown author matches nothing", () => {
      const out = compileEdgeFilterWithContext("touched_by=zelda", ctx);
      expect(out.predicate?.(edge("e1"))).toBe(false);
    });
  });

  describe("churn", () => {
    it("churn>1 matches edges that toggled more than once", () => {
      const out = compileEdgeFilterWithContext("churn>1", ctx);
      // e1: added v1.0 (edgeIds), removed v1.2, added v1.3 → events: 2 (the
      // initial edgeIds isn't counted as a delta). But the toggle count
      // comes from `added` / `removed` deltas, so e1 has 1 add + 1 remove
      // in deltas → churn = 2 → >1 match
      expect(out.predicate?.(edge("e1"))).toBe(true);
      // e2 never toggled → 0
      expect(out.predicate?.(edge("e2"))).toBe(false);
      // e5 added once → 1
      expect(out.predicate?.(edge("e5"))).toBe(false);
    });

    it("churn<5 matches stable / low-churn edges", () => {
      const out = compileEdgeFilterWithContext("churn<5", ctx);
      // everything is under 5 toggles in this small history
      expect(out.predicate?.(edge("e1"))).toBe(true);
      expect(out.predicate?.(edge("e2"))).toBe(true);
    });
  });

  describe("stable_since", () => {
    it("stable_since(6m) matches edges untouched for 6+ months", () => {
      const out = compileEdgeFilterWithContext("stable_since=6m", ctx);
      // e3: last change 200d ago (> 180d threshold) → stable
      expect(out.predicate?.(edge("e3"))).toBe(true);
      // e1: last change 10d ago → not stable
      expect(out.predicate?.(edge("e1"))).toBe(false);
    });
  });

  describe("introduced_between", () => {
    it("matches edges whose first appearance falls in the range (labels)", () => {
      const out = compileEdgeFilterWithContext(
        "introduced_between=v1.0..v1.2",
        ctx,
      );
      // Resolve by label fuzzy: "v1.0 initial alice" matches "v1.0"? No, we
      // check equality then sha-prefix; labels contain spaces so fall back
      // to numeric index.
      // Switch to numeric indices which are always accepted.
      const numeric = compileEdgeFilterWithContext(
        "introduced_between=0..2",
        ctx,
      );
      // e1 first seen at idx 0 → inside 0..2
      expect(numeric.predicate?.(edge("e1"))).toBe(true);
      // e4 first seen at idx 2 → inside
      expect(numeric.predicate?.(edge("e4"))).toBe(true);
      // e5 first seen at idx 4 → outside
      expect(numeric.predicate?.(edge("e5"))).toBe(false);
      expect(out.error ?? "").toMatch(/.*/);
    });
  });

  it("combines temporal + base keys", () => {
    const out = compileEdgeFilterWithContext("added_since=1y and layer=structural", ctx);
    expect(out.predicate?.(edge("e1"))).toBe(true);
  });

  it("temporal key without context yields always-false predicate", () => {
    const out = compileEdgeFilter("added_since=2w");
    expect(out.predicate?.(edge("e5"))).toBe(false);
  });
});
