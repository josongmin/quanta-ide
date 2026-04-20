import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  clearViewport,
  debounce,
  loadViewport,
  saveViewport,
} from "./viewport-persistence";

// In-memory localStorage stub — the default test environment in this
// repo doesn't ship a writable one, and the persistence module feature-
// detects via probe writes, so we swap in a working Storage shim.
class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number { return this.store.size; }
  clear(): void { this.store.clear(); }
  getItem(k: string): string | null { return this.store.get(k) ?? null; }
  setItem(k: string, v: string): void { this.store.set(k, String(v)); }
  removeItem(k: string): void { this.store.delete(k); }
  key(i: number): string | null { return [...this.store.keys()][i] ?? null; }
}

describe("viewport-persistence", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", new MemoryStorage());
  });

  it("round-trips a saved pose", () => {
    saveViewport("tabA", { tx: 100, ty: -50, scale: 0.5, tier: "building", selectedId: "x.ts" });
    const got = loadViewport("tabA");
    expect(got?.tx).toBe(100);
    expect(got?.ty).toBe(-50);
    expect(got?.scale).toBeCloseTo(0.5);
    expect(got?.tier).toBe("building");
    expect(got?.selectedId).toBe("x.ts");
    expect(typeof got?.at).toBe("number");
  });

  it("keeps per-tabId slots independent", () => {
    saveViewport("a", { tx: 1, ty: 2, scale: 1, tier: "galaxy", selectedId: null });
    saveViewport("b", { tx: 10, ty: 20, scale: 2, tier: "building", selectedId: "x" });
    expect(loadViewport("a")?.tier).toBe("galaxy");
    expect(loadViewport("b")?.tier).toBe("building");
  });

  it("falls back to the `default` slot when tabId is omitted", () => {
    saveViewport(undefined, { tx: 5, ty: 5, scale: 1, tier: "universe", selectedId: null });
    expect(loadViewport(undefined)?.tx).toBe(5);
  });

  it("returns null when nothing is saved", () => {
    expect(loadViewport("unknown")).toBe(null);
  });

  it("returns null on corrupt / wrong-version payloads", () => {
    localStorage.setItem("cu:viewport:v1:bad", "not-json");
    expect(loadViewport("bad")).toBe(null);
    localStorage.setItem(
      "cu:viewport:v1:oldv",
      JSON.stringify({ v: 0, tx: 1, ty: 1, scale: 1, tier: "universe", selectedId: null, at: 0 }),
    );
    expect(loadViewport("oldv")).toBe(null);
  });

  it("clearViewport removes the slot", () => {
    saveViewport("tabA", { tx: 1, ty: 1, scale: 1, tier: "universe", selectedId: null });
    clearViewport("tabA");
    expect(loadViewport("tabA")).toBe(null);
  });
});

describe("debounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("coalesces rapid calls into one trailing invocation", () => {
    const fn = vi.fn<(v: number) => void>();
    const d = debounce(fn, 100);
    d(1);
    d(2);
    d(3);
    vi.advanceTimersByTime(50);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(3);
  });

  it("flush invokes pending args immediately", () => {
    const fn = vi.fn<(v: string) => void>();
    const d = debounce(fn, 500);
    d("x");
    d.flush();
    expect(fn).toHaveBeenCalledWith("x");
  });

  it("cancel drops pending args silently", () => {
    const fn = vi.fn<(v: number) => void>();
    const d = debounce(fn, 100);
    d(7);
    d.cancel();
    vi.advanceTimersByTime(500);
    expect(fn).not.toHaveBeenCalled();
  });
});
