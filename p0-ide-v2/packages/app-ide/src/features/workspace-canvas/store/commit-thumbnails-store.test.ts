import { describe, it, expect } from "vitest";
import { commitThumbnailsStore } from "./commit-thumbnails-store";

// The store is currently a read-only shell (no writers after the
// capture pipeline was removed). These tests just lock down that the
// read surface FilmStripScrubber depends on keeps its shape.

describe("commitThumbnailsStore (read-only shell)", () => {
  it("getState returns an empty, stable snapshot", () => {
    const s = commitThumbnailsStore.getState();
    expect(s.byShortSha.size).toBe(0);
    expect(s.totalBytes).toBe(0);
  });

  it("getThumbnail returns undefined for any shortSha", () => {
    expect(commitThumbnailsStore.getThumbnail("abc1234")).toBeUndefined();
  });

  it("subscribe returns a no-op unsubscribe and never fires", () => {
    let fired = 0;
    const unsub = commitThumbnailsStore.subscribe(() => { fired++; });
    expect(typeof unsub).toBe("function");
    unsub();
    expect(fired).toBe(0);
  });
});
