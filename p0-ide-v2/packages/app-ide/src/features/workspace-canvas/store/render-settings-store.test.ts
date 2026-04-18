import { describe, it, expect } from "vitest";
import { renderSettingsStore, ALL_EDGE_KINDS } from "./render-settings-store";

describe("render-settings-store edgeKinds", () => {
  it("defaults all 19 canonical edge kinds to on", () => {
    const { edgeKinds } = renderSettingsStore.getState();
    expect(ALL_EDGE_KINDS.length).toBe(19);
    for (const k of ALL_EDGE_KINDS) {
      expect(edgeKinds[k]).toBe(true);
    }
  });

  it("setEdgeKind toggles an individual kind without touching others", () => {
    renderSettingsStore.setEdgeKind("call", false);
    const after = renderSettingsStore.getState().edgeKinds;
    expect(after.call).toBe(false);
    for (const k of ALL_EDGE_KINDS) {
      if (k === "call") continue;
      expect(after[k]).toBe(true);
    }
    // restore
    renderSettingsStore.setEdgeKind("call", true);
    expect(renderSettingsStore.getState().edgeKinds.call).toBe(true);
  });

  it("notifies subscribers on change", () => {
    let ticks = 0;
    const unsub = renderSettingsStore.subscribe(() => { ticks += 1; });
    renderSettingsStore.setEdgeKind("blast", false);
    renderSettingsStore.setEdgeKind("blast", true);
    unsub();
    expect(ticks).toBe(2);
  });

  it("produces a fresh edgeKinds reference so useSyncExternalStore sees it", () => {
    const before = renderSettingsStore.getState().edgeKinds;
    renderSettingsStore.setEdgeKind("cycle", false);
    const after = renderSettingsStore.getState().edgeKinds;
    expect(after).not.toBe(before);
    renderSettingsStore.setEdgeKind("cycle", true);
  });
});
