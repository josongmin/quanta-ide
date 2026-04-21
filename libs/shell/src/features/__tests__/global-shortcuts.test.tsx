import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// vi.hoisted so mock factories can reference these.
// ---------------------------------------------------------------------------

const { mockUiBus, mockShortcutRegistry, mockTabBus, registeredBindings } = vi.hoisted(() => {
  const registeredBindings: Array<{
    id: string;
    keys: string;
    label: string;
    run: (e: KeyboardEvent) => void;
    when?: () => boolean;
    ignoreMods?: boolean;
  }> = [];

  let uiState = {
    paletteOpen: false,
    devConsoleOpen: false,
    rulesOpen: false,
    settingsOpen: false,
    dashboardOpen: false,
  };

  const mockUiBus = {
    get: () => uiState,
    togglePalette: vi.fn((open?: boolean) => {
      uiState = { ...uiState, paletteOpen: open ?? !uiState.paletteOpen };
    }),
    toggleDevConsole: vi.fn((open?: boolean) => {
      uiState = { ...uiState, devConsoleOpen: open ?? !uiState.devConsoleOpen };
    }),
    toggleRules: vi.fn((open?: boolean) => {
      uiState = { ...uiState, rulesOpen: open ?? !uiState.rulesOpen };
    }),
    toggleSettings: vi.fn((open?: boolean) => {
      uiState = { ...uiState, settingsOpen: open ?? !uiState.settingsOpen };
    }),
    toggleDashboard: vi.fn((open?: boolean) => {
      uiState = { ...uiState, dashboardOpen: open ?? !uiState.dashboardOpen };
    }),
    _reset: () => {
      uiState = { paletteOpen: false, devConsoleOpen: false, rulesOpen: false, settingsOpen: false, dashboardOpen: false };
    },
    _set: (patch: Partial<typeof uiState>) => {
      uiState = { ...uiState, ...patch };
    },
  };

  const mockShortcutRegistry = {
    register: vi.fn((binding: (typeof registeredBindings)[number]) => {
      registeredBindings.push(binding);
      return () => {
        const idx = registeredBindings.indexOf(binding);
        if (idx >= 0) registeredBindings.splice(idx, 1);
      };
    }),
    dispatch: vi.fn(),
  };

  const mockTabBus = {
    open: vi.fn(),
  };

  return { mockUiBus, mockShortcutRegistry, mockTabBus, registeredBindings };
});

vi.mock("@quanta/shell/stores/ui-bus", () => ({ uiBus: mockUiBus }));
vi.mock("@quanta/shell/stores/shortcut-registry", () => ({ shortcutRegistry: mockShortcutRegistry }));
vi.mock("@quanta/shell/stores/tab-bus", () => ({ tabBus: mockTabBus }));

import { useGlobalShortcuts } from "../global-shortcuts/model/use-global-shortcuts";

// ---------------------------------------------------------------------------

describe("useGlobalShortcuts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registeredBindings.length = 0;
    mockUiBus._reset();
  });

  afterEach(() => {
    registeredBindings.length = 0;
  });

  it("registers shell shortcuts on mount", () => {
    const { unmount } = renderHook(() => useGlobalShortcuts());
    // Should have registered multiple shortcuts (palette open variants, new-tab, escape).
    expect(mockShortcutRegistry.register).toHaveBeenCalled();
    const callCount = mockShortcutRegistry.register.mock.calls.length;
    expect(callCount).toBeGreaterThanOrEqual(5);
    unmount();
  });

  it("disposers are called on unmount (cleans up bindings)", () => {
    const { unmount } = renderHook(() => useGlobalShortcuts());
    const bindingsBeforeUnmount = registeredBindings.length;
    expect(bindingsBeforeUnmount).toBeGreaterThan(0);
    unmount();
    // All registered bindings should have been removed via disposers.
    expect(registeredBindings.length).toBe(0);
  });

  it("escape closes palette first when palette is open", () => {
    renderHook(() => useGlobalShortcuts());
    mockUiBus._set({ paletteOpen: true });

    // Find the escape binding.
    const escBinding = registeredBindings.find((b) => b.id === "escape.shell");
    expect(escBinding).toBeDefined();

    // Guard should return true since palette is open.
    expect(escBinding!.when!()).toBe(true);

    // Run it.
    escBinding!.run(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(mockUiBus.togglePalette).toHaveBeenCalledWith(false);
  });

  it("escape closes devConsole when palette is closed but devConsole is open", () => {
    renderHook(() => useGlobalShortcuts());
    mockUiBus._set({ devConsoleOpen: true });

    const escBinding = registeredBindings.find((b) => b.id === "escape.shell");
    expect(escBinding).toBeDefined();
    expect(escBinding!.when!()).toBe(true);

    escBinding!.run(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(mockUiBus.toggleDevConsole).toHaveBeenCalledWith(false);
  });

  it("non-matching key does nothing: escape guard returns false when nothing is open", () => {
    renderHook(() => useGlobalShortcuts());
    const escBinding = registeredBindings.find((b) => b.id === "escape.shell");
    expect(escBinding).toBeDefined();

    // Nothing is open: guard should return false.
    expect(escBinding!.when!()).toBe(false);
  });

  it("adds keydown listener on window and removes on unmount", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");

    const { unmount } = renderHook(() => useGlobalShortcuts());
    expect(addSpy).toHaveBeenCalledWith("keydown", expect.any(Function));

    unmount();
    expect(removeSpy).toHaveBeenCalledWith("keydown", expect.any(Function));

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
