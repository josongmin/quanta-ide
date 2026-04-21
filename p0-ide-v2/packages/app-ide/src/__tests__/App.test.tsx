import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { ShellProvider } from "@quanta/shell-contract";
import type { ShellAPI } from "@quanta/shell-contract";

// ---------------------------------------------------------------------------
// Mock heavy child trees so we only test IdeApp mount behaviour.
// ---------------------------------------------------------------------------

vi.mock("@quanta/app-ide/pages/ide", () => ({
  IdePage: (props: Record<string, unknown>) => (
    <div data-testid="ide-page" data-props={JSON.stringify(Object.keys(props))} />
  ),
}));

vi.mock("@quanta/app-ide/stores/focus-store", () => ({
  focusStore: {
    setMode: vi.fn(),
    get: vi.fn(() => ({
      simulateOpen: false,
      contextInjectOpen: false,
      firewallOpen: false,
    })),
    toggleSimulate: vi.fn(),
    toggleContextInject: vi.fn(),
    toggleFirewall: vi.fn(),
  },
}));

vi.mock("@quanta/app-ide/features/simulate-change", () => ({
  SimulateOverlay: () => <div data-testid="simulate-overlay" />,
}));

vi.mock("@quanta/app-ide/features/context-inject", () => ({
  ContextInjectOverlay: () => <div data-testid="context-inject-overlay" />,
}));

vi.mock("@quanta/app-ide/features/firewall-inspector", () => ({
  FirewallOverlay: () => <div data-testid="firewall-overlay" />,
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
    toggleDashboard: vi.fn(),
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

describe("IdeApp", () => {
  // Import lazily so mocks are in place.
  let IdeApp: typeof import("../App").IdeApp;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../App");
    IdeApp = mod.IdeApp;
  });

  it("renders without crashing", () => {
    const { shell } = renderWithShell(
      <IdeApp tabId="t1" isActive />,
    );
    expect(shell).toBeDefined();
  });

  it("registers three overlays on mount", () => {
    const registerOverlay = vi.fn(() => vi.fn());
    const shell = createMockShellAPI({ registerOverlay });

    renderWithShell(<IdeApp tabId="t1" isActive />, shell);

    expect(registerOverlay).toHaveBeenCalledTimes(3);
    expect(registerOverlay).toHaveBeenCalledWith("simulate", expect.any(Function));
    expect(registerOverlay).toHaveBeenCalledWith("context-inject", expect.any(Function));
    expect(registerOverlay).toHaveBeenCalledWith("firewall", expect.any(Function));
  });

  it("registers shortcuts on mount", () => {
    const registerShortcuts = vi.fn(() => vi.fn());
    const shell = createMockShellAPI({ registerShortcuts });

    renderWithShell(<IdeApp tabId="t1" isActive />, shell);

    expect(registerShortcuts).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const call = (registerShortcuts as any).mock.calls[0];
    const bindings = call[0] as Array<{ id: string }>;
    expect(bindings).toHaveLength(2);
    expect(bindings[0].id).toBe("inspector.mode.overview");
    expect(bindings[1].id).toBe("escape.ide");
  });
});
