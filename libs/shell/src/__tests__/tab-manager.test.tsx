import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock the tabBus module BEFORE importing useTabManager so the module-level
// import inside tab-manager.ts resolves to our fake.
// ---------------------------------------------------------------------------

const subscribers = new Set<() => void>();
let pendingReq: { id: number; app: string; label: string } | null = null;

vi.mock("@quanta/shell/stores/tab-bus", () => ({
  tabBus: {
    subscribe: (fn: () => void) => {
      subscribers.add(fn);
      return () => {
        subscribers.delete(fn);
      };
    },
    consume: () => {
      const r = pendingReq;
      pendingReq = null;
      return r;
    },
  },
}));

import { useTabManager } from "../tab-manager";
import type { TabDescriptor } from "@quanta/shell-contract";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const INITIAL_TABS: TabDescriptor[] = [
  { id: "t1", app: "ide", label: "order-service" },
  { id: "t2", app: "ide", label: "payment-service" },
];

function setup(tabs: TabDescriptor[] = INITIAL_TABS) {
  return renderHook(() => useTabManager(tabs));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useTabManager", () => {
  beforeEach(() => {
    subscribers.clear();
    pendingReq = null;
  });

  it("initial state matches the provided tabs", () => {
    const { result } = setup();
    expect(result.current.state.tabs).toEqual(INITIAL_TABS);
    expect(result.current.state.activeId).toBe("t1");
    expect(result.current.state.homeOpen).toBe(false);
  });

  it("addTab creates a new tab and sets it active", () => {
    const { result } = setup();
    act(() => {
      result.current.addTab();
    });
    expect(result.current.state.tabs).toHaveLength(3);
    const newTab = result.current.state.tabs[2];
    expect(newTab.app).toBe("new-tab");
    expect(newTab.label).toBe("New Tab");
    expect(result.current.state.activeId).toBe(newTab.id);
  });

  it("closeTab removes the tab and falls back to the last remaining tab", () => {
    const { result } = setup();
    act(() => {
      // Active is t1; close t1 => should fall back to t2 (last in list).
      result.current.closeTab("t1");
    });
    expect(result.current.state.tabs).toHaveLength(1);
    expect(result.current.state.tabs[0].id).toBe("t2");
    expect(result.current.state.activeId).toBe("t2");
  });

  it("closeTab on non-active tab keeps the active tab unchanged", () => {
    const { result } = setup();
    act(() => {
      result.current.closeTab("t2");
    });
    expect(result.current.state.tabs).toHaveLength(1);
    expect(result.current.state.activeId).toBe("t1");
  });

  it("closeTab on the last tab does not crash", () => {
    const singleTab: TabDescriptor[] = [{ id: "only", app: "ide", label: "solo" }];
    const { result } = setup(singleTab);
    act(() => {
      result.current.closeTab("only");
    });
    expect(result.current.state.tabs).toHaveLength(0);
    // activeId remains unchanged since next.length === 0.
    expect(result.current.state.activeId).toBe("only");
  });

  it("selectTab updates activeId and closes home", () => {
    const { result } = setup();
    // First open home.
    act(() => {
      result.current.toggleHome();
    });
    expect(result.current.state.homeOpen).toBe(true);

    // Now select a tab — should close home.
    act(() => {
      result.current.selectTab("t2");
    });
    expect(result.current.state.activeId).toBe("t2");
    expect(result.current.state.homeOpen).toBe(false);
  });

  it("toggleHome flips the homeOpen flag", () => {
    const { result } = setup();
    expect(result.current.state.homeOpen).toBe(false);
    act(() => {
      result.current.toggleHome();
    });
    expect(result.current.state.homeOpen).toBe(true);
    act(() => {
      result.current.toggleHome();
    });
    expect(result.current.state.homeOpen).toBe(false);
  });

  it("tabBus subscription opens programmatic tabs", () => {
    const { result } = setup();
    expect(result.current.state.tabs).toHaveLength(2);

    // Simulate tabBus emitting an open request.
    pendingReq = { id: 42, app: "agent", label: "Agent Tab" };
    act(() => {
      for (const fn of subscribers) fn();
    });

    expect(result.current.state.tabs).toHaveLength(3);
    const added = result.current.state.tabs[2];
    expect(added.app).toBe("agent");
    expect(added.label).toBe("Agent Tab");
    expect(result.current.state.activeId).toBe(added.id);
  });

  it("openTab sets homeOpen to false", () => {
    const { result } = setup();
    act(() => {
      result.current.toggleHome();
    });
    expect(result.current.state.homeOpen).toBe(true);
    act(() => {
      result.current.openTab("agent", "Agent");
    });
    expect(result.current.state.homeOpen).toBe(false);
    expect(result.current.state.tabs).toHaveLength(3);
  });
});
