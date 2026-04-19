import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TabDescriptor } from "@quanta/shell-contract";

// ---------------------------------------------------------------------------
// Mock tabBus.
// ---------------------------------------------------------------------------

vi.mock("@quanta/shell/stores/tab-bus", () => ({
  tabBus: {
    subscribe: vi.fn(() => vi.fn()),
    consume: vi.fn(() => null),
  },
}));

import { useTabManager } from "../tab-manager";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setup(tabs: TabDescriptor[] = []) {
  return renderHook(() => useTabManager(tabs));
}

// ---------------------------------------------------------------------------
// Edge-case tests
// ---------------------------------------------------------------------------

describe("useTabManager — edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("close the only tab does not crash and leaves empty tabs", () => {
    const { result } = setup([{ id: "solo", app: "ide", label: "Solo" }]);
    expect(result.current.state.tabs).toHaveLength(1);

    act(() => {
      result.current.closeTab("solo");
    });

    expect(result.current.state.tabs).toHaveLength(0);
    // activeId remains "solo" because there's no fallback.
    expect(result.current.state.activeId).toBe("solo");
  });

  it("add tab with duplicate-ish label still creates a new entry (ids are unique via timestamp)", () => {
    const { result } = setup([{ id: "t1", app: "ide", label: "Editor" }]);

    act(() => {
      result.current.openTab("ide", "Editor");
    });

    // Two tabs exist, both labelled "Editor" but with distinct ids.
    expect(result.current.state.tabs).toHaveLength(2);
    const ids = result.current.state.tabs.map((t) => t.id);
    expect(new Set(ids).size).toBe(2);
  });

  it("rapid add/close/select sequence does not throw or lose state", () => {
    const { result } = setup([{ id: "t1", app: "ide", label: "Init" }]);

    act(() => {
      result.current.addTab();
    });
    const addedId = result.current.state.tabs[1].id;

    act(() => {
      result.current.selectTab("t1");
    });
    expect(result.current.state.activeId).toBe("t1");

    act(() => {
      result.current.closeTab(addedId);
    });
    expect(result.current.state.tabs).toHaveLength(1);
    expect(result.current.state.activeId).toBe("t1");

    act(() => {
      result.current.addTab();
      result.current.addTab();
    });
    expect(result.current.state.tabs).toHaveLength(3);
  });

  it("home toggle while settings-like state: toggleHome still works", () => {
    const { result } = setup([{ id: "t1", app: "ide", label: "Main" }]);

    act(() => {
      result.current.toggleHome();
    });
    expect(result.current.state.homeOpen).toBe(true);

    act(() => {
      result.current.toggleHome();
    });
    expect(result.current.state.homeOpen).toBe(false);
  });

  it("tab order preserved after close — splice position is correct", () => {
    const tabs: TabDescriptor[] = [
      { id: "a", app: "ide", label: "A" },
      { id: "b", app: "ide", label: "B" },
      { id: "c", app: "ide", label: "C" },
      { id: "d", app: "ide", label: "D" },
    ];
    const { result } = setup(tabs);

    // Close "b" (index 1). Remaining: [a, c, d].
    act(() => {
      result.current.closeTab("b");
    });

    const remaining = result.current.state.tabs.map((t) => t.id);
    expect(remaining).toEqual(["a", "c", "d"]);
  });

  it("initialize with empty tabs array does not crash", () => {
    const { result } = setup([]);
    expect(result.current.state.tabs).toHaveLength(0);
    expect(result.current.state.activeId).toBe("");
  });
});
