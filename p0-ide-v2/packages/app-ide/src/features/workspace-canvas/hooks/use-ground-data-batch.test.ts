import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  enqueueGroundFetch,
  registerMount,
  unregisterMount,
  __resetGroundFetchCoordinator,
} from "./use-ground-data-batch";
import { sceneStore } from "../store/scene-store";

// Mocked loader — unit tests for the coordinator must not hit the real
// SAMPLE_SOURCES / repo-loader paths. Each test replaces the mock body.
vi.mock("../data/loaders", () => ({
  loadGroundDataBatch: vi.fn(async (_ids: readonly string[]) => ({})),
}));

// Inlined typed handle on the mocked module so tests can override per-case.
const { loadGroundDataBatch } = await import("../data/loaders");
const loaderMock = loadGroundDataBatch as unknown as ReturnType<typeof vi.fn>;

function resetSceneStoreGround(): void {
  // Touch both slices so dirty state from a prior test can't leak.
  sceneStore.setGroundDataBatch([], []);
  for (const id of Object.keys(sceneStore.getState().groundData)) {
    sceneStore.setGroundLoading(id, false);
  }
}

describe("use-ground-data-batch", () => {
  beforeEach(() => {
    __resetGroundFetchCoordinator();
    resetSceneStoreGround();
    loaderMock.mockReset();
  });

  afterEach(() => {
    __resetGroundFetchCoordinator();
  });

  it("coalesces multiple enqueues in one microtask into a single loader call", async () => {
    loaderMock.mockResolvedValue({ a: { source: "A" }, b: { source: "B" }, c: { source: "C" } });
    registerMount("a"); registerMount("b"); registerMount("c");

    const pA = enqueueGroundFetch("a");
    const pB = enqueueGroundFetch("b");
    const pC = enqueueGroundFetch("c");
    await Promise.all([pA, pB, pC]);

    expect(loaderMock).toHaveBeenCalledTimes(1);
    const callArg = loaderMock.mock.calls[0][0] as readonly string[];
    expect([...callArg].sort()).toEqual(["a", "b", "c"]);
  });

  it("writes data and clears groundLoading for mounted ids after flush", async () => {
    loaderMock.mockResolvedValue({ x: { source: "X" }, y: { source: "Y" } });
    registerMount("x"); registerMount("y");

    await enqueueGroundFetch("x");
    await enqueueGroundFetch("y");

    const s = sceneStore.getState();
    expect(s.groundData.x?.source).toBe("X");
    expect(s.groundData.y?.source).toBe("Y");
    expect(s.groundLoading.x).toBe(false);
    expect(s.groundLoading.y).toBe(false);
  });

  it("dedupes concurrent enqueues for the same id (one promise)", async () => {
    loaderMock.mockResolvedValue({ dupe: { source: "S" } });
    registerMount("dupe");

    const p1 = enqueueGroundFetch("dupe");
    // Wait a microtask so the flush runs; the coordinator puts the id
    // into inFlight, so subsequent enqueues share that promise.
    await Promise.resolve();
    const p2 = enqueueGroundFetch("dupe");
    await Promise.all([p1, p2]);

    expect(loaderMock).toHaveBeenCalledTimes(1);
    expect(sceneStore.getState().groundData.dupe?.source).toBe("S");
  });

  it("drops store writes for ids whose mount was cancelled before flush resolves", async () => {
    let resolveLoader: ((v: Record<string, { source: string }>) => void) | null = null;
    loaderMock.mockImplementation(
      () => new Promise<Record<string, { source: string }>>(r => { resolveLoader = r; }),
    );
    registerMount("live");
    registerMount("dead");
    const pLive = enqueueGroundFetch("live");
    const pDead = enqueueGroundFetch("dead");

    // Let the queueMicrotask flush fire so the loader call runs and captures
    // its resolve handle.
    await Promise.resolve();
    await Promise.resolve();

    // Before fetch resolves, "dead" unmounts.
    unregisterMount("dead");

    // Now resolve the loader with data for both ids.
    expect(resolveLoader).not.toBeNull();
    resolveLoader!({ live: { source: "L" }, dead: { source: "D" } });
    await Promise.all([pLive, pDead]);

    const s = sceneStore.getState();
    expect(s.groundData.live?.source).toBe("L");
    // "dead" was unmounted before resolution → store write filtered out.
    expect(s.groundData.dead).toBeUndefined();
  });
});
