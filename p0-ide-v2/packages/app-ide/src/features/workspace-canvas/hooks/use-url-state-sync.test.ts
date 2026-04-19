import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useUrlStateSync } from "./use-url-state-sync";
import { viewportStore } from "../store/viewport-store";
import { uxSettingsStore } from "../store/ux-settings-store";

// Covers the write-side of the URL sync: once `autoSyncUrl` is on, changes
// to the subscribed stores must fire a debounced `history.replaceState`.
// The read-side (module-scope `sharedStateApplied` latch, share-link apply)
// is exercised indirectly — we can't cleanly reset a module-scope boolean
// across tests, so we stick to the write path which is re-armed every time
// the flag toggles.

describe("useUrlStateSync", () => {
  let replaceStateSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    // Ensure no ws fragment leaks into the test — the read-side would
    // otherwise try to apply mock state on first mount.
    window.history.replaceState(
      null,
      "",
      window.location.origin + window.location.pathname,
    );
    replaceStateSpy = vi.spyOn(window.history, "replaceState");
    // Start each case with auto-sync OFF so the write-side subscriptions
    // can be wired up by the test itself.
    uxSettingsStore.setAutoSyncUrl(false);
  });

  afterEach(() => {
    replaceStateSpy.mockRestore();
    vi.useRealTimers();
  });

  it("fires a single debounced replaceState for a burst of viewport changes", () => {
    const { unmount } = renderHook(() => useUrlStateSync());

    act(() => {
      uxSettingsStore.setAutoSyncUrl(true);
    });

    // scheduleWrite fires once on mount (kickoff). Record the baseline.
    act(() => {
      vi.advanceTimersByTime(500);
    });
    const baseline = replaceStateSpy.mock.calls.length;

    // Burst of 5 viewport changes inside a single debounce window.
    act(() => {
      for (let i = 1; i <= 5; i++) {
        viewportStore.setViewport({
          x: i,
          y: i,
          scale: 0.5,
          width: 100,
          height: 100,
        });
      }
    });

    // Before debounce elapses — no additional replaceState.
    expect(replaceStateSpy.mock.calls.length).toBe(baseline);

    // After debounce window elapses — exactly ONE replaceState fired for
    // the whole burst (scheduleWrite short-circuits while a timer is pending).
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(replaceStateSpy.mock.calls.length).toBe(baseline + 1);

    unmount();
  });

  it("replaceState URL encodes captured state as ?ws=", () => {
    const { unmount } = renderHook(() => useUrlStateSync());
    act(() => {
      uxSettingsStore.setAutoSyncUrl(true);
    });

    act(() => {
      viewportStore.setViewport({
        x: 50,
        y: 60,
        scale: 1,
        width: 200,
        height: 200,
      });
      vi.advanceTimersByTime(500);
    });

    const lastCall = replaceStateSpy.mock.calls.at(-1);
    expect(lastCall).toBeDefined();
    // Signature: history.replaceState(data, unused, url)
    const url = lastCall?.[2];
    expect(typeof url).toBe("string");
    expect(String(url)).toContain("?ws=");

    unmount();
  });

  it("unmount unsubscribes — no replaceState after unmount", () => {
    const { unmount } = renderHook(() => useUrlStateSync());
    act(() => {
      uxSettingsStore.setAutoSyncUrl(true);
      vi.advanceTimersByTime(500);
    });

    unmount();
    const countAfterUnmount = replaceStateSpy.mock.calls.length;

    // Post-unmount change should not write anything.
    act(() => {
      viewportStore.setViewport({
        x: 9999,
        y: 9999,
        scale: 1,
        width: 10,
        height: 10,
      });
      vi.advanceTimersByTime(1000);
    });
    expect(replaceStateSpy.mock.calls.length).toBe(countAfterUnmount);
  });

  it("autoSyncUrl=false does not subscribe at all", () => {
    const { unmount } = renderHook(() => useUrlStateSync());
    // autoSyncUrl is false (beforeEach); pushing store changes should
    // NOT schedule a replaceState, even after the debounce window.
    const baseline = replaceStateSpy.mock.calls.length;
    act(() => {
      viewportStore.setViewport({
        x: 7,
        y: 7,
        scale: 1,
        width: 10,
        height: 10,
      });
      vi.advanceTimersByTime(1000);
    });
    expect(replaceStateSpy.mock.calls.length).toBe(baseline);
    unmount();
  });
});
