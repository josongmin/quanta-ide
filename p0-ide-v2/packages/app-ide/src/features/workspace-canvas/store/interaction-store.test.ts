import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { interactionStore } from "./interaction-store";

describe("interaction-store", () => {
  beforeEach(() => {
    // Return to canonical baseline so tests are independent.
    interactionStore.resetLod("galaxy");
    interactionStore.resetSelection();
  });

  it("setLod short-circuits when value unchanged", () => {
    interactionStore.setLod("city");
    const listener = vi.fn();
    const unsubscribe = interactionStore.subscribe(listener);
    interactionStore.setLod("city");
    expect(listener).not.toHaveBeenCalled();
    interactionStore.setLod("street");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(interactionStore.getState().lod).toBe("street");
    unsubscribe();
  });

  it("selectFile short-circuits when the id is unchanged", () => {
    interactionStore.selectFile("src/a.ts");
    const listener = vi.fn();
    const unsubscribe = interactionStore.subscribe(listener);
    interactionStore.selectFile("src/a.ts");
    expect(listener).not.toHaveBeenCalled();
    interactionStore.selectFile("src/b.ts");
    expect(listener).toHaveBeenCalledTimes(1);
    expect(interactionStore.getState().viewState.selectedFileId).toBe("src/b.ts");
    unsubscribe();
  });

  it("hoverFile short-circuits when the id is unchanged", () => {
    interactionStore.hoverFile("src/a.ts");
    const listener = vi.fn();
    const unsubscribe = interactionStore.subscribe(listener);
    interactionStore.hoverFile("src/a.ts");
    expect(listener).not.toHaveBeenCalled();
    interactionStore.hoverFile(null);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(interactionStore.getState().viewState.hoveredFileId).toBe(null);
    unsubscribe();
  });

  it("selectEdge and hoverEdge update their ViewState fields", () => {
    interactionStore.selectEdge("edge-1");
    expect(interactionStore.getState().viewState.selectedEdgeId).toBe("edge-1");
    interactionStore.hoverEdge("edge-2");
    expect(interactionStore.getState().viewState.hoveredEdgeId).toBe("edge-2");
    // Short-circuits on same value.
    const listener = vi.fn();
    const unsubscribe = interactionStore.subscribe(listener);
    interactionStore.selectEdge("edge-1");
    interactionStore.hoverEdge("edge-2");
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  describe("graphFlash", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("sets graphFlash and clears it via setTimeout after the duration", () => {
      interactionStore.flashGraph("g1", 2000);
      const flash = interactionStore.getState().graphFlash;
      expect(flash).not.toBe(null);
      expect(flash?.graphId).toBe("g1");

      // Halfway through — still active.
      vi.advanceTimersByTime(1000);
      expect(interactionStore.getState().graphFlash).not.toBe(null);

      // Past the deadline — the decay setTimeout fires and clears it.
      vi.advanceTimersByTime(1100);
      expect(interactionStore.getState().graphFlash).toBe(null);
    });
  });
});
