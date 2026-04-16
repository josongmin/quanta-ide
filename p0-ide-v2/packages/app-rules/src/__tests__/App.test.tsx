import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { ShellProvider } from "@quanta/shell-contract";
import type { ShellAPI } from "@quanta/shell-contract";

// ---------------------------------------------------------------------------
// Mock the RulesPage and RulesModal to isolate RulesApp.
// ---------------------------------------------------------------------------

vi.mock("@quanta/app-rules/pages/rules", () => ({
  RulesPage: () => <div data-testid="rules-page">Rules content</div>,
  RulesModal: () => <div data-testid="rules-modal">Rules modal</div>,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockShellAPI(overrides: Partial<ShellAPI> = {}): ShellAPI {
  return {
    openTab: vi.fn(),
    closeTab: vi.fn(),
    selectTab: vi.fn(),
    toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
    togglePalette: vi.fn(),
    toggleDevConsole: vi.fn(),
    toggleSettings: vi.fn(),
    toggleRules: vi.fn(),
    theme: { current: "light", toggle: vi.fn() },
    registerFeatures: vi.fn(() => vi.fn()),
    registerShortcuts: vi.fn(() => vi.fn()),
    registerOverlay: vi.fn(() => vi.fn()),
    ...overrides,
  };
}

function renderWithShell(ui: ReactElement, api?: ShellAPI) {
  const shell = api ?? createMockShellAPI();
  const utils = render(
    <ShellProvider value={shell}>{ui}</ShellProvider>,
  );
  return { ...utils, shell };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("RulesApp", () => {
  let RulesApp: typeof import("../App").RulesApp;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../App");
    RulesApp = mod.RulesApp;
  });

  it("renders without crashing", () => {
    const { shell } = renderWithShell(<RulesApp tabId="t1" isActive />);
    expect(shell).toBeDefined();
  });

  it("renders the RulesPage", () => {
    renderWithShell(<RulesApp tabId="t1" isActive />);
    expect(screen.getByTestId("rules-page")).toBeInTheDocument();
    expect(screen.getByText("Rules content")).toBeInTheDocument();
  });

  it("registers the rules-modal overlay on mount", () => {
    const registerOverlay = vi.fn(() => vi.fn());
    const shell = createMockShellAPI({ registerOverlay });

    renderWithShell(<RulesApp tabId="t1" isActive />, shell);

    expect(registerOverlay).toHaveBeenCalledTimes(1);
    expect(registerOverlay).toHaveBeenCalledWith("rules-modal", expect.any(Function));
  });

  it("cleans up the overlay registration on unmount", () => {
    const disposer = vi.fn();
    const registerOverlay = vi.fn(() => disposer);
    const shell = createMockShellAPI({ registerOverlay });

    const { unmount } = renderWithShell(<RulesApp tabId="t1" isActive />, shell);
    expect(disposer).not.toHaveBeenCalled();

    unmount();
    expect(disposer).toHaveBeenCalledTimes(1);
  });
});
