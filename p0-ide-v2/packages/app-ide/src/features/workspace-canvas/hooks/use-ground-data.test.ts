import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useGroundData } from "./use-ground-data";
import { sceneStore } from "../store/scene-store";
import { __resetGroundFetchCoordinator } from "./use-ground-data-batch";

// `useGroundData` is a thin subscribe + enqueue wrapper over the batch
// coordinator. We mock `loadGroundDataBatch` so test runs are synchronous
// and don't touch any transport; behaviours tested here are the hook's
// own subscription + effect contract.
vi.mock("../data/loaders", () => ({
  loadGroundDataBatch: vi.fn(async (ids: readonly string[]) => {
    const out: Record<string, { source: string }> = {};
    for (const id of ids) out[id] = { source: `src:${id}` };
    return out;
  }),
}));

const { loadGroundDataBatch } = await import("../data/loaders");
const loaderMock = loadGroundDataBatch as unknown as ReturnType<typeof vi.fn>;

function resetScene(): void {
  // Wipe caches via the batch entrypoint (single emission).
  sceneStore.setGroundDataBatch(
    [],
    Object.keys(sceneStore.getState().groundData),
  );
  for (const id of Object.keys(sceneStore.getState().groundData)) {
    sceneStore.setGroundLoading(id, false);
  }
}

describe("useGroundData", () => {
  beforeEach(() => {
    __resetGroundFetchCoordinator();
    resetScene();
    loaderMock.mockClear();
  });

  afterEach(() => {
    __resetGroundFetchCoordinator();
  });

  it("initial state returns null data and loading=false when cache is empty", () => {
    const { result } = renderHook(() => useGroundData("fresh"));
    // Before the microtask fires, the hook returns the store's current
    // snapshot — no data, loading flag unset (defaults to false).
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("enqueues a fetch on mount and eventually reports loaded data", async () => {
    const { result, rerender } = renderHook(() => useGroundData("alpha"));

    // Microtask flush + async loader resolution.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    rerender();

    expect(loaderMock).toHaveBeenCalledTimes(1);
    expect(result.current.data?.source).toBe("src:alpha");
    expect(result.current.loading).toBe(false);
  });

  it("does not re-enqueue when the scene store already has cached data", async () => {
    // Pre-populate the store so the effect short-circuits on !data.
    sceneStore.setGroundData("cached", { source: "pre-cached" });

    const { result } = renderHook(() => useGroundData("cached"));
    await act(async () => {
      await Promise.resolve();
    });

    expect(loaderMock).not.toHaveBeenCalled();
    expect(result.current.data?.source).toBe("pre-cached");
  });

  it("multiple simultaneous mounts for distinct ids coalesce to one loader call", async () => {
    const { rerender: r1 } = renderHook(() => useGroundData("m1"));
    const { rerender: r2 } = renderHook(() => useGroundData("m2"));
    const { rerender: r3 } = renderHook(() => useGroundData("m3"));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    r1(); r2(); r3();

    expect(loaderMock).toHaveBeenCalledTimes(1);
    const ids = loaderMock.mock.calls[0][0] as readonly string[];
    expect([...ids].sort()).toEqual(["m1", "m2", "m3"]);
  });
});
