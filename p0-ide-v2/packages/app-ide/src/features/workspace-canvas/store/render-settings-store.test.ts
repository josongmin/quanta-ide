import { describe, it, expect } from "vitest";
import { renderSettingsStore, ALL_EDGE_KINDS } from "./render-settings-store";

describe("render-settings-store edgeKinds", () => {
  it("defaults every canonical edge kind to on", () => {
    const { edgeKinds } = renderSettingsStore.getState();
    expect(ALL_EDGE_KINDS.length).toBe(28);
    for (const k of ALL_EDGE_KINDS) {
      expect(edgeKinds[k]).toBe(true);
    }
  });

  it("covers every layer (structural/flow/safety/impact)", () => {
    // Rough sanity: each layer should contribute at least one kind. We
    // don't hardcode counts here because the exhaustiveness check in the
    // store is the single source of truth for the membership list.
    const kinds = new Set(ALL_EDGE_KINDS);
    expect(kinds.has("import")).toBe(true);         // structural
    expect(kinds.has("dataflow")).toBe(true);       // flow
    expect(kinds.has("taint-propagation")).toBe(true); // safety
    expect(kinds.has("blast")).toBe(true);          // impact
    // New additions that used to be missing — guard against regression.
    expect(kinds.has("test-covers")).toBe(true);
    expect(kinds.has("clone")).toBe(true);
    expect(kinds.has("feature-flag")).toBe(true);
    expect(kinds.has("contract")).toBe(true);
    expect(kinds.has("dead-edge")).toBe(true);
    expect(kinds.has("runtime-divergence")).toBe(true);
    expect(kinds.has("cochange")).toBe(true);
    expect(kinds.has("rename-pair")).toBe(true);
    expect(kinds.has("supply-chain")).toBe(true);
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
