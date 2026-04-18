import { describe, it, expect } from "vitest";
import { ageColor, stripesFromBlame } from "./blame";
import type { FileBlame } from "./blame";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 3, 17);

describe("ageColor", () => {
  it("distinguishes 1-day vs 30-day vs 180-day vs 2-year", () => {
    const c1d  = ageColor(NOW - 1   * DAY,    NOW);
    const c30  = ageColor(NOW - 30  * DAY,    NOW);
    const c180 = ageColor(NOW - 180 * DAY,    NOW);
    const c2y  = ageColor(NOW - 2   * 365 * DAY, NOW);
    const set = new Set([c1d, c30, c180, c2y]);
    expect(set.size).toBe(4);
  });

  it("clamps negative ages (future commits) to freshest tier", () => {
    const fresh = ageColor(NOW - 1 * DAY, NOW);
    const future = ageColor(NOW + 10 * DAY, NOW);
    expect(future).toBe(fresh);
  });
});

describe("stripesFromBlame", () => {
  it("returns [] for empty entries", () => {
    const blame: FileBlame = { fileId: "f", entries: [], lineCount: 0 };
    expect(stripesFromBlame(blame, NOW)).toEqual([]);
  });

  it("collapses adjacent entries of similar age into one stripe", () => {
    const blame: FileBlame = {
      fileId: "f",
      lineCount: 30,
      entries: [
        { startLine: 1, endLine: 10, committedAt: NOW - 1 * DAY, author: "a" },
        { startLine: 11, endLine: 20, committedAt: NOW - 2 * DAY, author: "b" },
        { startLine: 21, endLine: 30, committedAt: NOW - 400 * DAY, author: "c" },
      ],
    };
    const stripes = stripesFromBlame(blame, NOW);
    expect(stripes.length).toBe(2);
    expect(stripes[0].fromLine).toBe(1);
    expect(stripes[0].toLine).toBe(20);
    expect(stripes[1].fromLine).toBe(21);
    expect(stripes[1].toLine).toBe(30);
  });

  it("keeps non-adjacent same-age entries as separate stripes", () => {
    const blame: FileBlame = {
      fileId: "f",
      lineCount: 30,
      entries: [
        { startLine: 1, endLine: 5, committedAt: NOW - 1 * DAY, author: "a" },
        { startLine: 15, endLine: 20, committedAt: NOW - 1 * DAY, author: "a" },
      ],
    };
    const stripes = stripesFromBlame(blame, NOW);
    expect(stripes.length).toBe(2);
  });
});
