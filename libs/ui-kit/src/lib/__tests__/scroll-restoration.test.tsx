import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Fresh module per test to reset the internal cache Map.
// ---------------------------------------------------------------------------

async function freshHook() {
  const mod = await import("../scroll-restoration");
  return mod.useScrollRestoration;
}

describe("useScrollRestoration", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("restores scrollTop from cache on mount", async () => {
    const useScrollRestoration = await freshHook();
    const el = { scrollTop: 0 } as HTMLElement;
    const ref = { current: el };

    // First mount + unmount with scrollTop=150 to seed the cache.
    const { unmount } = renderHook(() => useScrollRestoration("key-a", ref));
    el.scrollTop = 150;
    unmount();

    // Second mount: scrollTop should be restored.
    el.scrollTop = 0;
    renderHook(() => useScrollRestoration("key-a", ref));
    expect(el.scrollTop).toBe(150);
  });

  it("saves scrollTop on unmount", async () => {
    const useScrollRestoration = await freshHook();
    const el = { scrollTop: 0 } as HTMLElement;
    const ref = { current: el };

    const { unmount } = renderHook(() => useScrollRestoration("save-test", ref));
    el.scrollTop = 300;
    unmount();

    // Re-mount and check the position was restored from saved value.
    el.scrollTop = 0;
    renderHook(() => useScrollRestoration("save-test", ref));
    expect(el.scrollTop).toBe(300);
  });

  it("different keys maintain separate scroll positions", async () => {
    const useScrollRestoration = await freshHook();
    const elA = { scrollTop: 0 } as HTMLElement;
    const elB = { scrollTop: 0 } as HTMLElement;
    const refA = { current: elA };
    const refB = { current: elB };

    // Seed key-a with 100.
    const hookA = renderHook(() => useScrollRestoration("key-a", refA));
    elA.scrollTop = 100;
    hookA.unmount();

    // Seed key-b with 200.
    const hookB = renderHook(() => useScrollRestoration("key-b", refB));
    elB.scrollTop = 200;
    hookB.unmount();

    // Restore: each key should get its own value.
    elA.scrollTop = 0;
    elB.scrollTop = 0;
    renderHook(() => useScrollRestoration("key-a", refA));
    renderHook(() => useScrollRestoration("key-b", refB));
    expect(elA.scrollTop).toBe(100);
    expect(elB.scrollTop).toBe(200);
  });

  it("re-mount restores the saved position after multiple mount/unmount cycles", async () => {
    const useScrollRestoration = await freshHook();
    const el = { scrollTop: 0 } as HTMLElement;
    const ref = { current: el };

    // Cycle 1: save 50.
    const h1 = renderHook(() => useScrollRestoration("cycle", ref));
    el.scrollTop = 50;
    h1.unmount();

    // Cycle 2: should restore to 50, then update to 80.
    el.scrollTop = 0;
    const h2 = renderHook(() => useScrollRestoration("cycle", ref));
    expect(el.scrollTop).toBe(50);
    el.scrollTop = 80;
    h2.unmount();

    // Cycle 3: should restore to 80.
    el.scrollTop = 0;
    renderHook(() => useScrollRestoration("cycle", ref));
    expect(el.scrollTop).toBe(80);
  });
});
