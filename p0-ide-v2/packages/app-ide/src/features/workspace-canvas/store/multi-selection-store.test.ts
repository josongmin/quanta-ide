import { describe, it, expect, beforeEach } from "vitest";
import { multiSelectionStore } from "./multi-selection-store";

describe("multi-selection-store", () => {
  beforeEach(() => {
    multiSelectionStore.clear();
  });

  it("setSelection replaces the selection", () => {
    multiSelectionStore.setSelection(["a", "b"]);
    expect(multiSelectionStore.getState().selectedFileIds).toEqual(["a", "b"]);
    multiSelectionStore.setSelection(["c"]);
    expect(multiSelectionStore.getState().selectedFileIds).toEqual(["c"]);
  });

  it("addToSelection merges new ids", () => {
    multiSelectionStore.setSelection(["a"]);
    multiSelectionStore.addToSelection(["b", "c"]);
    const ids = [...multiSelectionStore.getState().selectedFileIds].sort();
    expect(ids).toEqual(["a", "b", "c"]);
  });

  it("removeFromSelection drops ids", () => {
    multiSelectionStore.setSelection(["a", "b", "c"]);
    multiSelectionStore.removeFromSelection(["b"]);
    expect(multiSelectionStore.getState().selectedFileIds).toEqual(["a", "c"]);
  });

  it("clear resets the selection", () => {
    multiSelectionStore.setSelection(["a"]);
    multiSelectionStore.clear();
    expect(multiSelectionStore.getState().selectedFileIds.length).toBe(0);
  });

  it("setSelection is a no-op when the set is identical", () => {
    multiSelectionStore.setSelection(["a", "b"]);
    let ticks = 0;
    const unsubscribe = multiSelectionStore.subscribe(() => { ticks += 1; });
    multiSelectionStore.setSelection(["b", "a"]);
    unsubscribe();
    expect(ticks).toBe(0);
  });
});
