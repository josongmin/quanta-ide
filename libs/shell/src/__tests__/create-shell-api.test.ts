import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// vi.hoisted ensures these are available when vi.mock factories run.
// ---------------------------------------------------------------------------

const {
  mockToast,
  mockUiBus,
  mockFeatureRegistry,
  mockShortcutRegistry,
  mockOverlayRegistry,
} = vi.hoisted(() => ({
  mockToast: {
    success: vi.fn(),
    info: vi.fn(),
    danger: vi.fn(),
    warn: vi.fn(),
  },
  mockUiBus: {
    togglePalette: vi.fn(),
    toggleDevConsole: vi.fn(),
    toggleSettings: vi.fn(),
    toggleRules: vi.fn(),
  },
  mockFeatureRegistry: {
    register: vi.fn(),
    unregister: vi.fn(),
  },
  mockShortcutRegistry: {
    register: vi.fn(() => vi.fn()),
  },
  mockOverlayRegistry: {
    register: vi.fn(() => vi.fn()),
  },
}));

vi.mock("@quanta/shell/stores/toast-store", () => ({ toast: mockToast }));
vi.mock("@quanta/shell/stores/ui-bus", () => ({ uiBus: mockUiBus }));
vi.mock("@quanta/shell/stores/shortcut-registry", () => ({ shortcutRegistry: mockShortcutRegistry }));
vi.mock("@quanta/shell/stores/feature-registry", () => ({ featureRegistry: mockFeatureRegistry }));
vi.mock("../overlay-registry", () => ({ overlayRegistry: mockOverlayRegistry }));

import { createShellAPI } from "../create-shell-api";
import type { FeatureManifest } from "@quanta/shell-contract";

// ---------------------------------------------------------------------------

function stubTabActions() {
  return {
    openTab: vi.fn(),
    closeTab: vi.fn(),
    selectTab: vi.fn(),
  };
}

describe("createShellAPI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("toast.success delegates to toast-store success", () => {
    const api = createShellAPI(stubTabActions());
    api.toast.success("worked");
    expect(mockToast.success).toHaveBeenCalledWith("worked");
  });

  it("toast.error delegates to toast-store danger", () => {
    const api = createShellAPI(stubTabActions());
    api.toast.error("failed");
    expect(mockToast.danger).toHaveBeenCalledWith("failed");
  });

  it("toast.info delegates to toast-store info", () => {
    const api = createShellAPI(stubTabActions());
    api.toast.info("note");
    expect(mockToast.info).toHaveBeenCalledWith("note");
  });

  it("registerFeatures calls featureRegistry.register for each manifest and returns disposer", () => {
    const api = createShellAPI(stubTabActions());
    const manifests = [
      { id: "f1", title: "F1", description: "d", category: "intelligence", visibility: "user", version: "1" },
      { id: "f2", title: "F2", description: "d", category: "editing", visibility: "user", version: "1" },
    ] as FeatureManifest[];

    const dispose = api.registerFeatures(manifests);
    expect(mockFeatureRegistry.register).toHaveBeenCalledTimes(2);
    expect(mockFeatureRegistry.register).toHaveBeenCalledWith(manifests[0]);
    expect(mockFeatureRegistry.register).toHaveBeenCalledWith(manifests[1]);

    dispose();
    expect(mockFeatureRegistry.unregister).toHaveBeenCalledTimes(2);
    expect(mockFeatureRegistry.unregister).toHaveBeenCalledWith("f1");
    expect(mockFeatureRegistry.unregister).toHaveBeenCalledWith("f2");
  });

  it("registerShortcuts calls shortcutRegistry.register for each binding and returns disposer", () => {
    const api = createShellAPI(stubTabActions());
    const d1 = vi.fn();
    const d2 = vi.fn();
    mockShortcutRegistry.register.mockReturnValueOnce(d1).mockReturnValueOnce(d2);

    const bindings = [
      { id: "s1", keys: "mod+p", label: "Palette", run: vi.fn() },
      { id: "s2", keys: "mod+k", label: "Search", run: vi.fn() },
    ];

    const dispose = api.registerShortcuts(bindings);
    expect(mockShortcutRegistry.register).toHaveBeenCalledTimes(2);

    dispose();
    expect(d1).toHaveBeenCalledTimes(1);
    expect(d2).toHaveBeenCalledTimes(1);
  });

  it("registerOverlay delegates to overlayRegistry", () => {
    const api = createShellAPI(stubTabActions());
    const Comp = () => null;
    const disposer = vi.fn();
    mockOverlayRegistry.register.mockReturnValueOnce(disposer);

    const result = api.registerOverlay("my-overlay", Comp);
    expect(mockOverlayRegistry.register).toHaveBeenCalledWith("my-overlay", Comp);
    expect(result).toBe(disposer);
  });

  it("togglePalette delegates to uiBus", () => {
    const api = createShellAPI(stubTabActions());
    api.togglePalette();
    expect(mockUiBus.togglePalette).toHaveBeenCalledTimes(1);
  });

  it("toggleSettings delegates to uiBus", () => {
    const api = createShellAPI(stubTabActions());
    api.toggleSettings();
    expect(mockUiBus.toggleSettings).toHaveBeenCalledTimes(1);
  });
});
