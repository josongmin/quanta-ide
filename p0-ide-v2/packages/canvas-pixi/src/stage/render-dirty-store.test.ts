import { describe, it, expect, beforeEach } from "vitest";
import {
  markDirty,
  markAllDirty,
  consumeDirty,
  peekDirty,
  anyDirty,
  __resetDirtyForTest,
} from "./render-dirty-store";

// render-dirty-store is a module-scope singleton. Each test resets via
// __resetDirtyForTest so order-dependence across this file (or across
// sibling suites in the same vitest worker) cannot corrupt state.

describe("render-dirty-store", () => {
  beforeEach(() => {
    __resetDirtyForTest(false);
  });

  it("markDirty flips a single bit, others stay false", () => {
    markDirty("layout");
    const snap = peekDirty();
    expect(snap.layout).toBe(true);
    expect(snap.edges).toBe(false);
    expect(snap.viewport).toBe(false);
  });

  it("markDirty is idempotent", () => {
    markDirty("edges");
    markDirty("edges");
    markDirty("edges");
    expect(peekDirty().edges).toBe(true);
  });

  it("consumeDirty returns current flags and resets all to false", () => {
    markDirty("layout");
    markDirty("viewport");
    const consumed = consumeDirty();
    expect(consumed.layout).toBe(true);
    expect(consumed.viewport).toBe(true);
    expect(consumed.edges).toBe(false);
    // Second consume should see everything false.
    const again = consumeDirty();
    expect(anyDirty(again)).toBe(false);
  });

  it("markAllDirty flips every bit", () => {
    markAllDirty();
    const snap = peekDirty();
    expect(snap.layout).toBe(true);
    expect(snap.edges).toBe(true);
    expect(snap.filters).toBe(true);
    expect(snap.viewport).toBe(true);
    expect(snap.selection).toBe(true);
    expect(snap.overlays).toBe(true);
  });

  it("anyDirty returns false only when every bit is false", () => {
    expect(
      anyDirty({
        layout: false,
        edges: false,
        filters: false,
        viewport: false,
        selection: false,
        overlays: false,
      }),
    ).toBe(false);
    expect(
      anyDirty({
        layout: false,
        edges: false,
        filters: false,
        viewport: false,
        selection: true,
        overlays: false,
      }),
    ).toBe(true);
  });
});
