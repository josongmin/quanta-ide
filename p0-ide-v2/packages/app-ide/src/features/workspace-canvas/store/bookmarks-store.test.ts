import { describe, it, expect, beforeEach } from "vitest";
import { bookmarksStore, bookmarksForPage } from "./bookmarks-store";

describe("bookmarks-store", () => {
  beforeEach(() => {
    bookmarksStore.reset();
  });

  it("creates a bookmark with auto-incrementing order within a page", () => {
    const a = bookmarksStore.create({
      pageId: "p1",
      label: "entry",
      cameraState: { x: 0, y: 0, scale: 1 },
    });
    const b = bookmarksStore.create({
      pageId: "p1",
      label: "sink",
      cameraState: { x: 100, y: 100, scale: 2 },
    });
    const c = bookmarksStore.create({
      pageId: "p2",
      label: "other-page",
      cameraState: { x: 0, y: 0, scale: 1 },
    });
    const list = bookmarksForPage(bookmarksStore.getState(), "p1");
    expect(list.map(x => x.id)).toEqual([a, b]);
    expect(list[0]!.order).toBe(0);
    expect(list[1]!.order).toBe(1);
    const other = bookmarksForPage(bookmarksStore.getState(), "p2");
    expect(other.map(x => x.id)).toEqual([c]);
    expect(other[0]!.order).toBe(0);
  });

  it("removes bookmarks and strips a page's set", () => {
    const a = bookmarksStore.create({
      pageId: "p1",
      label: "x",
      cameraState: { x: 0, y: 0, scale: 1 },
    });
    bookmarksStore.create({
      pageId: "p1",
      label: "y",
      cameraState: { x: 0, y: 0, scale: 1 },
    });
    bookmarksStore.remove(a);
    expect(bookmarksForPage(bookmarksStore.getState(), "p1").length).toBe(1);
    bookmarksStore.removeForPage("p1");
    expect(bookmarksForPage(bookmarksStore.getState(), "p1").length).toBe(0);
  });

  it("reorders within a page by id list", () => {
    const a = bookmarksStore.create({
      pageId: "p1",
      label: "a",
      cameraState: { x: 0, y: 0, scale: 1 },
    });
    const b = bookmarksStore.create({
      pageId: "p1",
      label: "b",
      cameraState: { x: 0, y: 0, scale: 1 },
    });
    const c = bookmarksStore.create({
      pageId: "p1",
      label: "c",
      cameraState: { x: 0, y: 0, scale: 1 },
    });
    bookmarksStore.reorder("p1", [c, a, b]);
    const list = bookmarksForPage(bookmarksStore.getState(), "p1");
    expect(list.map(x => x.id)).toEqual([c, a, b]);
  });
});
