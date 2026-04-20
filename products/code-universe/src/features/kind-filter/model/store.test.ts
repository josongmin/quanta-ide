import { describe, it, expect, beforeEach } from "vitest";
import { kindFilterStore } from "./store";

describe("kindFilterStore", () => {
  beforeEach(() => {
    kindFilterStore.reset();
  });

  it("starts with every kind visible", () => {
    const v = kindFilterStore.getState().visibility;
    expect(v.universe).toBe(true);
    expect(v.galaxy).toBe(true);
    expect(v.street).toBe(true);
    expect(v.building).toBe(true);
    expect(v.floor).toBe(true);
    expect(v.room).toBe(true);
  });

  it("toggle flips a single kind without touching the others", () => {
    kindFilterStore.toggle("building");
    const v = kindFilterStore.getState().visibility;
    expect(v.building).toBe(false);
    expect(v.room).toBe(true);
    expect(v.galaxy).toBe(true);
  });

  it("setVisible is idempotent — no emit when unchanged", () => {
    let emits = 0;
    const unsub = kindFilterStore.subscribe(() => {
      emits++;
    });
    kindFilterStore.setVisible("building", true); // already true
    kindFilterStore.setVisible("building", true); // still true
    expect(emits).toBe(0);
    kindFilterStore.setVisible("building", false);
    expect(emits).toBe(1);
    kindFilterStore.setVisible("building", false); // still false
    expect(emits).toBe(1);
    unsub();
  });

  it("reset restores the defaults", () => {
    kindFilterStore.setVisible("room", false);
    kindFilterStore.setVisible("floor", false);
    kindFilterStore.reset();
    const v = kindFilterStore.getState().visibility;
    expect(v.room).toBe(true);
    expect(v.floor).toBe(true);
  });

  it("isVisible mirrors the current visibility map", () => {
    expect(kindFilterStore.isVisible("galaxy")).toBe(true);
    kindFilterStore.setVisible("galaxy", false);
    expect(kindFilterStore.isVisible("galaxy")).toBe(false);
  });
});
