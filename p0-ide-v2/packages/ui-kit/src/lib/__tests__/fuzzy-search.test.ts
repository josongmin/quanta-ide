import { describe, it, expect } from "vitest";
import { matchPositions, positionScore } from "../fuzzy-search";

describe("matchPositions", () => {
  it("finds exact substring positions", () => {
    const result = matchPositions("hello world", "hello");
    expect(result).toEqual([0, 1, 2, 3, 4]);
  });

  it("returns null when needle is not a subsequence of haystack", () => {
    expect(matchPositions("abc", "z")).toBeNull();
  });

  it("returns empty array for empty needle", () => {
    expect(matchPositions("anything", "")).toEqual([]);
  });

  it("is case insensitive", () => {
    const result = matchPositions("Hello World", "hw");
    expect(result).toEqual([0, 6]);
  });

  it("finds non-contiguous subsequence positions", () => {
    const result = matchPositions("abcdef", "ace");
    expect(result).toEqual([0, 2, 4]);
  });

  it("returns null when only a partial subsequence matches", () => {
    expect(matchPositions("ab", "abc")).toBeNull();
  });
});

describe("positionScore", () => {
  it("returns 0 for empty positions", () => {
    expect(positionScore([])).toBe(0);
  });

  it("ranks a prefix match higher (lower score) than a later match", () => {
    // Prefix match: "abc" in "abcdef" -> positions [0,1,2]
    const prefixScore = positionScore([0, 1, 2]);
    // Later match: "def" in "abcdef" -> positions [3,4,5]
    const laterScore = positionScore([3, 4, 5]);
    expect(prefixScore).toBeLessThan(laterScore);
  });

  it("penalises gaps between positions", () => {
    // Consecutive: positions [0,1,2] => gaps = 0
    const consecutiveScore = positionScore([0, 1, 2]);
    // Gapped: positions [0,2,4] => gaps = 2
    const gappedScore = positionScore([0, 2, 4]);
    expect(consecutiveScore).toBeLessThan(gappedScore);
  });

  it("computes expected score for a known input", () => {
    // positions = [0, 1, 2]: start=0, span=2, gaps=0
    // score = 0*2 + 2 + 0*4 = 2
    expect(positionScore([0, 1, 2])).toBe(2);
  });

  it("penalises late start", () => {
    // [5, 6, 7]: start=5, span=2, gaps=0 => 5*2 + 2 + 0 = 12
    expect(positionScore([5, 6, 7])).toBe(12);
  });
});
