import { describe, it, expect, beforeEach, vi } from "vitest";
import { stickyStore } from "./store";

// In-memory storage stub — the default test env's localStorage isn't
// writable (see viewport-persistence.test.ts for the same pattern).
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number { return this.store.size; }
  clear(): void { this.store.clear(); }
  getItem(k: string): string | null { return this.store.get(k) ?? null; }
  setItem(k: string, v: string): void { this.store.set(k, String(v)); }
  removeItem(k: string): void { this.store.delete(k); }
  key(i: number): string | null { return [...this.store.keys()][i] ?? null; }
}

describe("stickyStore", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", new MemoryStorage());
    // Clear in-memory state from any prior test run.
    for (const id of [...stickyStore.getState().byEntityId.keys()]) {
      stickyStore.remove(id);
    }
    stickyStore.stopEditing();
  });

  it("set / get round-trip with a default colour", () => {
    stickyStore.set("pkg/x.ts", "refactor this");
    const s = stickyStore.get("pkg/x.ts");
    expect(s?.text).toBe("refactor this");
    expect(typeof s?.color).toBe("string");
  });

  it("empty text auto-removes the sticky", () => {
    stickyStore.set("a", "hello");
    expect(stickyStore.get("a")?.text).toBe("hello");
    stickyStore.set("a", "   ");
    expect(stickyStore.get("a")).toBe(null);
  });

  it("editing flag round-trips and clears on remove", () => {
    stickyStore.set("a", "x");
    stickyStore.startEditing("a");
    expect(stickyStore.getState().editingId).toBe("a");
    stickyStore.remove("a");
    expect(stickyStore.getState().editingId).toBe(null);
  });

  it("stopEditing is idempotent — no emit when already off", () => {
    let emits = 0;
    const unsub = stickyStore.subscribe(() => {
      emits++;
    });
    stickyStore.stopEditing(); // already null
    expect(emits).toBe(0);
    stickyStore.startEditing("a");
    expect(emits).toBe(1);
    stickyStore.stopEditing();
    expect(emits).toBe(2);
    stickyStore.stopEditing(); // null again → no emit
    expect(emits).toBe(2);
    unsub();
  });

  it("color override is remembered", () => {
    stickyStore.set("a", "text", "#fca5a5");
    expect(stickyStore.get("a")?.color).toBe("#fca5a5");
    // Subsequent set without color keeps the override
    stickyStore.set("a", "updated");
    expect(stickyStore.get("a")?.color).toBe("#fca5a5");
  });
});
