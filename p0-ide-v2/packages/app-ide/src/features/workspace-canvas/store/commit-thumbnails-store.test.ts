import { describe, it, expect, beforeEach } from "vitest";
import {
  commitThumbnailsStore,
  COMMIT_THUMBNAIL_LIMITS,
  type CommitThumbnail,
} from "./commit-thumbnails-store";

function makeThumb(sha: string, bytes: number): CommitThumbnail {
  // Build a data-URL of EXACTLY `bytes` chars (the entry-bytes
  // accounting looks at dataUrl.length directly, so we just produce
  // a string of the target length).
  return {
    sha,
    dataUrl: "a".repeat(Math.max(0, bytes)),
    capturedAt: 1,
  };
}

describe("commitThumbnailsStore", () => {
  beforeEach(() => {
    commitThumbnailsStore.clear();
  });

  it("set + getThumbnail round-trips", () => {
    commitThumbnailsStore.set("abc1234", makeThumb("abc1234", 500));
    const got = commitThumbnailsStore.getThumbnail("abc1234");
    expect(got?.sha).toBe("abc1234");
  });

  it("rejects entries larger than per-entry cap", () => {
    const oversized = makeThumb("big", COMMIT_THUMBNAIL_LIMITS.maxEntryBytes + 1);
    const accepted = commitThumbnailsStore.set("big", oversized);
    expect(accepted).toBe(false);
    expect(commitThumbnailsStore.has("big")).toBe(false);
  });

  it("evicts LRU when total budget exceeded", () => {
    // Fill cache with 50 entries at the per-entry max so the 51st
    // forces an eviction.
    const entryBytes = COMMIT_THUMBNAIL_LIMITS.maxEntryBytes - 1;
    for (let i = 0; i < 50; i++) {
      commitThumbnailsStore.set(`sha${i}`, makeThumb(`sha${i}`, entryBytes));
    }
    expect(commitThumbnailsStore.getState().byShortSha.size).toBe(50);
    commitThumbnailsStore.set("sha50", makeThumb("sha50", entryBytes));
    // Oldest (sha0) should now be gone; newest should be present.
    expect(commitThumbnailsStore.has("sha0")).toBe(false);
    expect(commitThumbnailsStore.has("sha50")).toBe(true);
    expect(commitThumbnailsStore.getState().byShortSha.size).toBeLessThanOrEqual(50);
  });

  it("re-setting same key updates LRU position without growing", () => {
    const entryBytes = COMMIT_THUMBNAIL_LIMITS.maxEntryBytes - 1;
    commitThumbnailsStore.set("a", makeThumb("a", entryBytes));
    commitThumbnailsStore.set("b", makeThumb("b", entryBytes));
    const before = commitThumbnailsStore.getState().totalBytes;
    commitThumbnailsStore.set("a", makeThumb("a", entryBytes));
    const after = commitThumbnailsStore.getState().totalBytes;
    expect(after).toBe(before);
    // Insertion-order should now be [b, a] (a re-set = tail).
    const keys = [...commitThumbnailsStore.getState().byShortSha.keys()];
    expect(keys[keys.length - 1]).toBe("a");
  });

  it("delete removes the entry and reclaims bytes", () => {
    commitThumbnailsStore.set("x", makeThumb("x", 500));
    const total = commitThumbnailsStore.getState().totalBytes;
    expect(total).toBeGreaterThan(0);
    expect(commitThumbnailsStore.delete("x")).toBe(true);
    expect(commitThumbnailsStore.has("x")).toBe(false);
    expect(commitThumbnailsStore.getState().totalBytes).toBe(0);
  });

  it("clear wipes state", () => {
    commitThumbnailsStore.set("x", makeThumb("x", 500));
    commitThumbnailsStore.set("y", makeThumb("y", 500));
    commitThumbnailsStore.clear();
    expect(commitThumbnailsStore.getState().byShortSha.size).toBe(0);
    expect(commitThumbnailsStore.getState().totalBytes).toBe(0);
  });

  it("subscribers are notified on mutations", () => {
    let fired = 0;
    const unsub = commitThumbnailsStore.subscribe(() => { fired++; });
    commitThumbnailsStore.set("a", makeThumb("a", 200));
    commitThumbnailsStore.delete("a");
    unsub();
    expect(fired).toBe(2);
  });
});
