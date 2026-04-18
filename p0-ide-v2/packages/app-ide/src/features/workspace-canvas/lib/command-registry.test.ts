import { describe, it, expect } from "vitest";
import { fuzzyScore, searchCommands, type Command } from "./command-registry";

describe("command-registry fuzzy", () => {
  it("returns null when the needle cannot be matched in order", () => {
    expect(fuzzyScore("zzz", "foobar")).toBeNull();
  });

  it("returns a score when all chars match in order", () => {
    const score = fuzzyScore("fb", "foobar");
    expect(score).not.toBeNull();
    expect(score! > 0).toBe(true);
  });

  it("scores start-of-word hits higher than middle hits", () => {
    const startHit = fuzzyScore("p", "palette")!;
    const midHit = fuzzyScore("p", "rapide")!;
    expect(startHit).toBeGreaterThan(midHit);
  });

  it("case-exact match scores higher than case-insensitive", () => {
    const exact = fuzzyScore("F", "File")!;
    const insensitive = fuzzyScore("F", "file")!;
    expect(exact).toBeGreaterThan(insensitive);
  });

  it("is case-insensitive for matching at all", () => {
    expect(fuzzyScore("FIL", "file.ts")).not.toBeNull();
  });
});

describe("command-registry search", () => {
  const sample: Command[] = [
    {
      id: "a",
      label: "Open file: app.ts",
      category: "files",
      run: () => {},
    },
    {
      id: "b",
      label: "Toggle: Command palette",
      category: "features",
      keywords: ["power.commandPalette"],
      run: () => {},
    },
    {
      id: "c",
      label: "Reset viewport",
      category: "actions",
      keywords: ["camera", "home"],
      run: () => {},
    },
  ];

  it("returns all commands (up to limit) for an empty query", () => {
    const r = searchCommands(sample, "", 10);
    expect(r.length).toBe(3);
  });

  it("filters out non-matching commands", () => {
    const r = searchCommands(sample, "zzz", 10);
    expect(r.length).toBe(0);
  });

  it("ranks better matches first", () => {
    const r = searchCommands(sample, "res", 10);
    expect(r[0]?.command.id).toBe("c");
  });

  it("matches against keywords as well as label", () => {
    const r = searchCommands(sample, "home", 10);
    expect(r.map(x => x.command.id)).toContain("c");
  });

  it("skips commands whose `when` predicate returns false", () => {
    const gated: Command[] = [
      ...sample,
      {
        id: "gated",
        label: "Gated thing",
        category: "other",
        run: () => {},
        when: () => false,
      },
    ];
    const r = searchCommands(gated, "", 10);
    expect(r.map(x => x.command.id)).not.toContain("gated");
  });
});
