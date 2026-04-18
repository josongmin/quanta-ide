import { describe, it, expect, beforeEach } from "vitest";
import { pagesStore, getActivePage } from "./pages-store";

describe("pages-store", () => {
  beforeEach(() => {
    pagesStore.resetToDefault();
  });

  it("seeds a single Main page by default", () => {
    const s = pagesStore.getState();
    expect(s.pages.length).toBe(1);
    expect(s.pages[0]!.label).toBe("Main");
    expect(s.activeId).toBe(s.pages[0]!.id);
  });

  it("creates, renames, and activates a new page", () => {
    const id = pagesStore.create("Security review");
    const s = pagesStore.getState();
    expect(s.pages.find(p => p.id === id)?.label).toBe("Security review");
    expect(s.activeId).toBe(id);

    pagesStore.rename(id, "Security");
    expect(pagesStore.getState().pages.find(p => p.id === id)?.label).toBe("Security");
  });

  it("never removes the last page", () => {
    const only = pagesStore.getState().pages[0]!.id;
    pagesStore.remove(only);
    expect(pagesStore.getState().pages.length).toBe(1);
  });

  it("removes non-last pages and falls back to the first remaining", () => {
    const a = pagesStore.create("A");
    const b = pagesStore.create("B");
    pagesStore.setActive(a);
    pagesStore.remove(a);
    const s = pagesStore.getState();
    expect(s.pages.find(p => p.id === a)).toBeUndefined();
    expect(s.pages.some(p => p.id === b)).toBe(true);
    expect(s.activeId).not.toBe(a);
  });

  it("updatePageState patches viewport + selection", () => {
    const id = pagesStore.getState().activeId;
    pagesStore.updatePageState(id, {
      viewport: { x: 10, y: 20, scale: 0.5 },
      selectedFileId: "file-x",
    });
    const p = getActivePage(pagesStore.getState());
    expect(p.viewport).toEqual({ x: 10, y: 20, scale: 0.5 });
    expect(p.selectedFileId).toBe("file-x");
  });
});
