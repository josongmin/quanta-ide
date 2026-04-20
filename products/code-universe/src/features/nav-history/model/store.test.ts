import { describe, it, expect, beforeEach } from "vitest";
import { navHistoryStore } from "./store";

describe("navHistoryStore", () => {
  beforeEach(() => {
    navHistoryStore.clear();
  });

  it("starts empty with cursor -1", () => {
    const s = navHistoryStore.getState();
    expect(s.entries).toHaveLength(0);
    expect(s.cursor).toBe(-1);
    expect(navHistoryStore.canGoBack()).toBe(false);
    expect(navHistoryStore.canGoForward()).toBe(false);
  });

  it("pushes advance the cursor", () => {
    navHistoryStore.push({ tier: "universe", selectedId: null });
    navHistoryStore.push({ tier: "galaxy", selectedId: "a" });
    const s = navHistoryStore.getState();
    expect(s.entries).toHaveLength(2);
    expect(s.cursor).toBe(1);
  });

  it("de-dupes consecutive identical pushes", () => {
    navHistoryStore.push({ tier: "universe", selectedId: null });
    navHistoryStore.push({ tier: "universe", selectedId: null });
    expect(navHistoryStore.getState().entries).toHaveLength(1);
  });

  it("back/forward moves the cursor without losing entries", () => {
    navHistoryStore.push({ tier: "universe", selectedId: null });
    navHistoryStore.push({ tier: "galaxy", selectedId: "a" });
    navHistoryStore.push({ tier: "street", selectedId: "b" });
    const back = navHistoryStore.back();
    expect(back?.tier).toBe("galaxy");
    expect(navHistoryStore.getState().cursor).toBe(1);
    const forward = navHistoryStore.forward();
    expect(forward?.tier).toBe("street");
    expect(navHistoryStore.getState().cursor).toBe(2);
  });

  it("back() at cursor 0 returns null", () => {
    navHistoryStore.push({ tier: "universe", selectedId: null });
    expect(navHistoryStore.back()).toBe(null);
  });

  it("suppresses the immediate next push after back() — avoids re-pushing the restored state", () => {
    navHistoryStore.push({ tier: "universe", selectedId: null });
    navHistoryStore.push({ tier: "galaxy", selectedId: "a" });
    navHistoryStore.back();
    // Simulated listener that naively pushes on restoration
    navHistoryStore.push({ tier: "universe", selectedId: null });
    // Entries stayed 2 (no new append), cursor stayed at 0
    expect(navHistoryStore.getState().entries).toHaveLength(2);
    expect(navHistoryStore.getState().cursor).toBe(0);
    // Now the suppress flag is consumed — the NEXT real push lands.
    navHistoryStore.push({ tier: "city", selectedId: "c" });
    // Building branches from index 0; the stale "galaxy" at 1 drops.
    expect(navHistoryStore.getState().entries).toHaveLength(2);
    expect(navHistoryStore.getState().entries[1]?.tier).toBe("city");
  });

  it("fresh push truncates forward history", () => {
    navHistoryStore.push({ tier: "universe", selectedId: null });
    navHistoryStore.push({ tier: "galaxy", selectedId: "a" });
    navHistoryStore.push({ tier: "street", selectedId: "b" });
    navHistoryStore.back(); // now at galaxy
    // Consume suppress so the fresh push actually records
    navHistoryStore.push({ tier: "galaxy", selectedId: "a" }); // suppressed + dedup
    navHistoryStore.push({ tier: "city", selectedId: "x" }); // real fresh
    const s = navHistoryStore.getState();
    expect(s.entries).toHaveLength(3);
    expect(s.entries[2]?.tier).toBe("city");
    expect(navHistoryStore.canGoForward()).toBe(false);
  });
});
