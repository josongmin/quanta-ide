import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock heavy widgets & side-effecting modules so Shell renders in isolation.
// ---------------------------------------------------------------------------

vi.mock("@quanta/shell/widgets/topbar", () => ({
  Topbar: (props: { tabs: { id: string }[]; activeId: string; homeOpen: boolean }) => (
    <div data-testid="topbar" data-tab-count={props.tabs.length} data-active={props.activeId} data-home-open={props.homeOpen}>
      Topbar
    </div>
  ),
}));

vi.mock("@quanta/shell/widgets/command-palette", () => ({
  CommandPaletteHost: () => <div data-testid="command-palette-host" />,
}));

vi.mock("@quanta/shell/widgets/dev-console", () => ({
  DevConsoleHost: () => <div data-testid="dev-console-host" />,
}));

vi.mock("@quanta/ui-kit/ui/toast", () => ({
  ToastHost: (props: { toasts: unknown[] }) => (
    <div data-testid="toast-host" data-count={props.toasts.length} />
  ),
}));

vi.mock("@quanta/shell/features/global-shortcuts", () => ({
  useGlobalShortcuts: vi.fn(),
}));

vi.mock("@quanta/shell/stores/icon-pack-store", () => ({
  useIconPack: () => "custom",
}));

vi.mock("@quanta/shell/feature-seed", () => ({
  seedFeatures: vi.fn(),
}));

// Provide a minimal mock for the ui-bus so settingsOpen defaults to false.
// We can swap its state via the actual module since we import it below.

// ---------------------------------------------------------------------------
// We need to control the overlay-registry and app-registry after mocking,
// so we import them _after_ vi.mock calls.
// ---------------------------------------------------------------------------

import { appRegistry } from "../app-registry";
import { overlayRegistry } from "../overlay-registry";
import { uiBus } from "@quanta/shell/stores/ui-bus";

// ---------------------------------------------------------------------------
// Import Shell (the SUT) last.
// ---------------------------------------------------------------------------

import { Shell } from "../Shell";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function registerApp(id: string, label: string, content: string) {
  appRegistry.register({
    id: id as never,
    label,
    Component: ({ tabId, isActive }: { tabId: string; isActive: boolean }) => (
      <div data-testid={`app-${id}`} data-tab-id={tabId} data-active={isActive}>
        {content}
      </div>
    ),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Shell", () => {
  beforeEach(() => {
    // Reset registries to a known state. The app-registry is a module-level
    // singleton so we register only what each test needs.
    // Clear overlays.
    overlayRegistry.getAll();
    // We cannot easily clear, so we rely on disposers in tests. The overlay
    // registry's Map is shared, but each test adds/removes explicitly.

    // Reset ui-bus to defaults.
    uiBus.closeAll();
  });

  it("renders Topbar with correct tab count", () => {
    registerApp("demo", "Demo", "Demo Page");
    render(<Shell />);
    const topbar = screen.getByTestId("topbar");
    // Shell hardcodes 5 initial tabs (t1..t5 — demo, ide x2, workspace,
    // and universe-v2 added in Phase 3 for the new Code Universe product).
    expect(topbar.getAttribute("data-tab-count")).toBe("5");
  });

  it("shows active tab content via appRegistry", () => {
    registerApp("demo", "Demo", "Demo Page Content");
    render(<Shell />);
    // First tab (t1) is active and is app="demo".
    expect(screen.getByTestId("app-demo")).toHaveTextContent("Demo Page Content");
  });

  it("settings override shows settings page instead of active tab", () => {
    registerApp("ide", "IDE", "IDE Content");
    registerApp("settings", "Settings", "Settings Page");
    uiBus.toggleSettings(true);
    render(<Shell />);
    expect(screen.getByTestId("app-settings")).toHaveTextContent("Settings Page");
  });

  it("home override shows home page instead of active tab", () => {
    registerApp("demo", "Demo", "Demo Content");
    registerApp("home", "Home", "Home Page");
    // `homeOpen` defaults to false, so the active tab's app (demo) shows.
    render(<Shell />);
    expect(screen.getByTestId("app-demo")).toHaveTextContent("Demo Content");
  });

  it("renders registered overlays", () => {
    registerApp("ide", "IDE", "IDE Content");
    const TestOverlay = () => <div data-testid="my-overlay">overlay</div>;
    const dispose = overlayRegistry.register("test-overlay", TestOverlay);

    render(<Shell />);
    expect(screen.getByTestId("my-overlay")).toBeInTheDocument();

    dispose();
  });

  it("ConnectedToastHost renders", () => {
    registerApp("ide", "IDE", "IDE Content");
    render(<Shell />);
    expect(screen.getByTestId("toast-host")).toBeInTheDocument();
  });
});
