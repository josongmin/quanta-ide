import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mock the SettingsPage to isolate SettingsApp.
// ---------------------------------------------------------------------------

vi.mock("@quanta/app-settings/pages/settings", () => ({
  SettingsPage: () => <div data-testid="settings-page">Settings content</div>,
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SettingsApp", () => {
  let SettingsApp: typeof import("../App").SettingsApp;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../App");
    SettingsApp = mod.SettingsApp;
  });

  it("renders without crashing", () => {
    const { container } = render(<SettingsApp tabId="t1" isActive />);
    expect(container).toBeTruthy();
  });

  it("contains SettingsPage content", () => {
    render(<SettingsApp tabId="t1" isActive />);
    expect(screen.getByTestId("settings-page")).toBeInTheDocument();
    expect(screen.getByText("Settings content")).toBeInTheDocument();
  });
});
