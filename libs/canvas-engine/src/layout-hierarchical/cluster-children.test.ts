import { describe, it, expect } from "vitest";
import type { Entity } from "../entity/types";
import {
  clusterChildren,
  stemOf,
  CLUSTER_MIN_CHILDREN,
} from "./cluster-children";

function mkEntity(name: string, kind: "building" | "street" = "building"): Entity {
  return {
    id: `${kind}:${name}`,
    kind,
    name,
    path: name,
    parentId: "universe:",
    childIds: [],
  };
}

describe("stemOf", () => {
  it("splits on dash", () => {
    expect(stemOf("user-service.ts")).toBe("user");
  });
  it("splits on underscore", () => {
    expect(stemOf("delta_admissibility.rs")).toBe("delta");
  });
  it("splits on dot", () => {
    expect(stemOf("user.test.ts")).toBe("user");
  });
  it("splits on camelCase boundary", () => {
    expect(stemOf("userService.ts")).toBe("user");
  });
  it("lowercases the stem", () => {
    expect(stemOf("User-Service.ts")).toBe("user");
  });
  it("returns null when stem is shorter than the minimum", () => {
    // `a-b.ts` → stem `a` is too short
    expect(stemOf("a-b.ts")).toBeNull();
    // `ab.ts` → stem `ab` is also below 3 chars
    expect(stemOf("ab.ts")).toBeNull();
  });
  it("strips a leading digit run", () => {
    expect(stemOf("01-intro.md")).toBe("intro");
    expect(stemOf("02_setup.md")).toBe("setup");
  });
  it("returns null for all-digit stems", () => {
    expect(stemOf("123.ts")).toBeNull();
  });
  it("treats a directory name the same as a file stem", () => {
    // bare `auth` directory shares stem with `auth.ts`
    expect(stemOf("auth")).toBe("auth");
    expect(stemOf("auth.ts")).toBe("auth");
  });
  it("handles all-caps at the stem length threshold", () => {
    // `API.ts` → `api` (3 chars, valid)
    expect(stemOf("API.ts")).toBe("api");
  });
  it("returns null for empty input", () => {
    expect(stemOf("")).toBeNull();
  });
  it("keeps the full name when there is no separator and no camel boundary", () => {
    expect(stemOf("admissibility")).toBe("admissibility");
  });
});

describe("clusterChildren", () => {
  it("returns input unchanged below the threshold", () => {
    const input = [
      mkEntity("user-service.ts"),
      mkEntity("user-types.ts"),
      mkEntity("other.ts"),
    ];
    const out = clusterChildren(input);
    expect(out).toBe(input);
  });

  it("groups cluster mates adjacent at the threshold", () => {
    // 10 siblings: 3 user-*, 3 delta-*, 1 outlier, 3 index-like ones
    // (but only 2 share `index` stem → 1 goes to other).
    const input = [
      mkEntity("user-service.ts"),
      mkEntity("delta_admissibility.rs"),
      mkEntity("other.ts"), // stem `other` alone → other bucket
      mkEntity("user-types.ts"),
      mkEntity("delta_plan.rs"),
      mkEntity("admissibility.rs"), // stem `admissibility` alone → other
      mkEntity("user.test.ts"),
      mkEntity("delta_source.rs"),
      mkEntity("index.ts"), // `index` alone → other
      mkEntity("README.md"), // stem `readme` alone → other
    ];
    expect(input.length).toBeGreaterThanOrEqual(CLUSTER_MIN_CHILDREN);

    const out = clusterChildren(input);
    const names = out.map(e => e.name);

    // User and delta clusters each have 3 members → both survive.
    const userIndices = names
      .map((n, i) => (n.startsWith("user") ? i : -1))
      .filter(i => i >= 0);
    const deltaIndices = names
      .map((n, i) => (n.startsWith("delta") ? i : -1))
      .filter(i => i >= 0);
    expect(userIndices).toHaveLength(3);
    expect(deltaIndices).toHaveLength(3);

    // Adjacency: a cluster's indices are contiguous.
    expect(userIndices[2]! - userIndices[0]!).toBe(2);
    expect(deltaIndices[2]! - deltaIndices[0]!).toBe(2);

    // Biggest-first (tied at 3) → alphabetical: delta before user.
    expect(deltaIndices[0]).toBeLessThan(userIndices[0]!);

    // Stable within cluster: user-service.ts (orig 0) before
    // user-types.ts (orig 3) before user.test.ts (orig 6).
    expect(names.indexOf("user-service.ts")).toBeLessThan(
      names.indexOf("user-types.ts"),
    );
    expect(names.indexOf("user-types.ts")).toBeLessThan(
      names.indexOf("user.test.ts"),
    );

    // Other bucket last: every non-cluster name sits after the last
    // cluster index.
    const lastClusterIdx = Math.max(...userIndices, ...deltaIndices);
    const otherNames = ["other.ts", "admissibility.rs", "index.ts", "README.md"];
    for (const n of otherNames) {
      expect(names.indexOf(n)).toBeGreaterThan(lastClusterIdx);
    }
  });

  it("permutes — no gain, no loss of entities", () => {
    const input = Array.from({ length: 12 }, (_, i) =>
      mkEntity(
        i < 4
          ? `user_${i}.ts`
          : i < 8
          ? `delta_${i}.ts`
          : `solo${i}.ts`,
      ),
    );
    const out = clusterChildren(input);
    expect(out).toHaveLength(input.length);
    expect(new Set(out.map(e => e.id))).toEqual(new Set(input.map(e => e.id)));
  });

  it("is deterministic across identical calls", () => {
    const input = Array.from({ length: 10 }, (_, i) =>
      mkEntity(i % 2 === 0 ? `user_${i}.ts` : `delta_${i}.ts`),
    );
    const a = clusterChildren(input).map(e => e.id);
    const b = clusterChildren(input).map(e => e.id);
    expect(a).toEqual(b);
  });

  it("clusters a directory with a file of the same stem", () => {
    const input = [
      mkEntity("auth", "street"),
      mkEntity("auth.ts", "building"),
      mkEntity("billing", "street"),
      mkEntity("billing-api.ts", "building"),
      mkEntity("billing-types.ts", "building"),
      mkEntity("standalone1.ts"),
      mkEntity("standalone2.ts"),
      mkEntity("standalone3.ts"),
    ];
    const out = clusterChildren(input);
    const names = out.map(e => e.name);
    const authIdx = [names.indexOf("auth"), names.indexOf("auth.ts")].sort(
      (a, b) => a - b,
    );
    const billIdx = [
      names.indexOf("billing"),
      names.indexOf("billing-api.ts"),
      names.indexOf("billing-types.ts"),
    ].sort((a, b) => a - b);
    // Each cluster's members are contiguous.
    expect(authIdx[1]! - authIdx[0]!).toBe(1);
    expect(billIdx[2]! - billIdx[0]!).toBe(2);
  });
});
