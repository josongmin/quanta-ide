import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ShellProvider, useShell } from "../context";
import type { ShellAPI } from "../shell-api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal ShellAPI stub satisfying the interface. */
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

/** A consumer component that renders the ShellAPI's theme value. */
function ShellConsumer() {
  const api = useShell();
  return <span data-testid="theme">{api.theme.current}</span>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("shell-contract / context", () => {
  it("useShell() throws when used outside ShellProvider", () => {
    // Suppress React error boundary console noise.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<ShellConsumer />)).toThrow(
      "useShell must be used within ShellProvider",
    );
    spy.mockRestore();
  });

  it("useShell() returns ShellAPI when inside ShellProvider", () => {
    const api = createMockShellAPI();
    render(
      <ShellProvider value={api}>
        <ShellConsumer />
      </ShellProvider>,
    );
    expect(screen.getByTestId("theme")).toHaveTextContent("light");
  });

  it("ShellProvider passes the provided API object through context", () => {
    const openTab = vi.fn();
    const api = createMockShellAPI({ openTab });

    function Caller() {
      const shell = useShell();
      return (
        <button onClick={() => shell.openTab("agent", "Test")}>call</button>
      );
    }

    render(
      <ShellProvider value={api}>
        <Caller />
      </ShellProvider>,
    );
    screen.getByText("call").click();
    expect(openTab).toHaveBeenCalledWith("agent", "Test");
  });

  it("nested ShellProviders shadow the outer value", () => {
    const outerApi = createMockShellAPI({ theme: { current: "dark", toggle: vi.fn() } });
    const innerApi = createMockShellAPI({ theme: { current: "light", toggle: vi.fn() } });

    render(
      <ShellProvider value={outerApi}>
        <ShellProvider value={innerApi}>
          <ShellConsumer />
        </ShellProvider>
      </ShellProvider>,
    );
    // Inner wins.
    expect(screen.getByTestId("theme")).toHaveTextContent("light");
  });

  it("ShellProvider value updates propagate to consumers", () => {
    const api1 = createMockShellAPI({ theme: { current: "dark", toggle: vi.fn() } });
    const api2 = createMockShellAPI({ theme: { current: "light", toggle: vi.fn() } });

    const { rerender } = render(
      <ShellProvider value={api1}>
        <ShellConsumer />
      </ShellProvider>,
    );
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");

    rerender(
      <ShellProvider value={api2}>
        <ShellConsumer />
      </ShellProvider>,
    );
    expect(screen.getByTestId("theme")).toHaveTextContent("light");
  });
});
