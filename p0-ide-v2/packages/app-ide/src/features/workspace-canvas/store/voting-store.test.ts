import { describe, it, expect, beforeEach } from "vitest";
import { votingStore, topVotedFiles } from "./voting-store";

describe("voting-store", () => {
  beforeEach(() => {
    votingStore.reset();
  });

  it("vote adds one entry per (target, voter)", () => {
    votingStore.vote({ kind: "file", id: "f1" }, "alice");
    votingStore.vote({ kind: "file", id: "f1" }, "alice");
    expect(votingStore.countFor({ kind: "file", id: "f1" })).toBe(1);
  });

  it("toggle flips vote on/off", () => {
    votingStore.toggle({ kind: "sticky", id: "s1" }, "bob");
    expect(votingStore.hasVoted({ kind: "sticky", id: "s1" }, "bob")).toBe(true);
    votingStore.toggle({ kind: "sticky", id: "s1" }, "bob");
    expect(votingStore.hasVoted({ kind: "sticky", id: "s1" }, "bob")).toBe(false);
  });

  it("unvote is a no-op when no vote exists (no emit)", () => {
    let ticks = 0;
    const unsub = votingStore.subscribe(() => { ticks += 1; });
    votingStore.unvote({ kind: "file", id: "missing" }, "you");
    expect(ticks).toBe(0);
    unsub();
  });

  it("topVotedFiles ranks files by count and clips to limit", () => {
    votingStore.vote({ kind: "file", id: "a" }, "u1");
    votingStore.vote({ kind: "file", id: "a" }, "u2");
    votingStore.vote({ kind: "file", id: "b" }, "u1");
    votingStore.vote({ kind: "file", id: "c" }, "u1");
    votingStore.vote({ kind: "file", id: "c" }, "u2");
    votingStore.vote({ kind: "file", id: "c" }, "u3");
    // Non-file entries should be skipped by topVotedFiles.
    votingStore.vote({ kind: "sticky", id: "s1" }, "u1");
    const top = topVotedFiles(votingStore.getState(), 2);
    expect(top.length).toBe(2);
    expect(top[0]!.fileId).toBe("c");
    expect(top[0]!.count).toBe(3);
    expect(top[1]!.fileId).toBe("a");
  });

  it("reset is a no-op when already empty", () => {
    let ticks = 0;
    const unsub = votingStore.subscribe(() => { ticks += 1; });
    votingStore.reset();
    expect(ticks).toBe(0);
    unsub();
  });
});
