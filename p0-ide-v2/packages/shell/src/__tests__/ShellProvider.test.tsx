import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mock heavy dependencies to isolate ShellProviderWrapper.
// ---------------------------------------------------------------------------

const { mockCreateShellAPI, mockUseIconPack } = vi.hoisted(() => ({
  mockCreateShellAPI: vi.fn(),
  mockUseIconPack: vi.fn(() => "custom"),
}));

vi.mock("../create-shell-api", () => ({
  createShellAPI: mockCreateShellAPI,
}));

vi.mock("@quanta/shell/stores/icon-pack-store", () => ({
  useIconPack: mockUseIconPack,
}));

// We need to verify context is provided, so we mock the contract providers
// to capture what they receive.

const { capturedShellValue, capturedIconPackValue } = vi.hoisted(() => ({
  capturedShellValue: { current: null as unknown },
  capturedIconPackValue: { current: null as unknown },
}));

vi.mock("@quanta/shell-contract", () => ({
  ShellProvider: ({ value, children }: { value: unknown; children: React.ReactNode }) => {
    capturedShellValue.current = value;
    return <div data-testid="shell-provider">{children}</div>;
  },
  IconPackProvider: ({ value, children }: { value: unknown; children: React.ReactNode }) => {
    capturedIconPackValue.current = value;
    return <div data-testid="icon-pack-provider">{children}</div>;
  },
}));

import { ShellProviderWrapper } from "../ShellProvider";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ShellProviderWrapper", () => {
  const stubTabActions = {
    openTab: vi.fn(),
    closeTab: vi.fn(),
    selectTab: vi.fn(),
  };

  const fakeApi = { __brand: "shell-api" };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateShellAPI.mockReturnValue(fakeApi);
    capturedShellValue.current = null;
    capturedIconPackValue.current = null;
  });

  it("renders children", () => {
    render(
      <ShellProviderWrapper tabActions={stubTabActions}>
        <span data-testid="child">hello</span>
      </ShellProviderWrapper>,
    );
    expect(screen.getByTestId("child")).toHaveTextContent("hello");
  });

  it("creates ShellAPI from tabActions and provides it via ShellProvider", () => {
    render(
      <ShellProviderWrapper tabActions={stubTabActions}>
        <span />
      </ShellProviderWrapper>,
    );
    expect(mockCreateShellAPI).toHaveBeenCalledWith(stubTabActions);
    expect(capturedShellValue.current).toBe(fakeApi);
  });

  it("provides the current icon pack via IconPackProvider", () => {
    mockUseIconPack.mockReturnValue("phosphor");
    render(
      <ShellProviderWrapper tabActions={stubTabActions}>
        <span />
      </ShellProviderWrapper>,
    );
    expect(capturedIconPackValue.current).toBe("phosphor");
  });

  it("nests ShellProvider > IconPackProvider > children", () => {
    render(
      <ShellProviderWrapper tabActions={stubTabActions}>
        <span data-testid="inner">nested</span>
      </ShellProviderWrapper>,
    );
    const shellProvider = screen.getByTestId("shell-provider");
    const iconPackProvider = screen.getByTestId("icon-pack-provider");
    expect(shellProvider).toContainElement(iconPackProvider);
    expect(iconPackProvider).toContainElement(screen.getByTestId("inner"));
  });
});
