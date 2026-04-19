import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mock heavy external deps to isolate Topbar rendering.
// ---------------------------------------------------------------------------

vi.mock("boring-avatars", () => ({
  default: ({ name }: { name: string }) => <div data-testid="avatar">{name}</div>,
}));

vi.mock("@quanta/ui-kit/lib", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

const { mockUiBus, mockUseUiBus } = vi.hoisted(() => ({
  mockUiBus: {
    toggleSettings: vi.fn(),
    togglePalette: vi.fn(),
  },
  mockUseUiBus: vi.fn(() => false),
}));

vi.mock("@quanta/shell/stores/ui-bus", () => ({
  uiBus: mockUiBus,
  useUiBus: mockUseUiBus,
}));

// Mock the tab strip hook to return minimal stubs.
vi.mock("../../widgets/topbar/model/use-workspace-tab-strip", () => ({
  useWorkspaceTabStrip: (_onClose: (id: string) => void) => ({
    stripRef: { current: null },
    onStripMouseLeave: vi.fn(),
    beginCloseTab: _onClose,
    tabChrome: (_tabId: string, isActive: boolean) => ({
      className: isActive ? "topbar__tab is-active" : "topbar__tab",
      style: undefined,
      innerStyle: undefined,
    }),
  }),
}));

import { Topbar, type Tab } from "../../widgets/topbar/ui/Topbar";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultProps(overrides: Partial<Parameters<typeof Topbar>[0]> = {}) {
  const tabs: Tab[] = [
    { id: "1", app: "ide", label: "main.ts" },
    { id: "2", app: "agent", label: "Agent Chat" },
  ];
  return {
    tabs,
    activeId: "1",
    onSelect: vi.fn(),
    onClose: vi.fn(),
    onAdd: vi.fn(),
    homeOpen: false,
    onToggleHome: vi.fn(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Topbar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseUiBus.mockReturnValue(false);
  });

  it("renders all tabs with their labels", () => {
    render(<Topbar {...defaultProps()} />);
    expect(screen.getByText("main.ts")).toBeInTheDocument();
    expect(screen.getByText("Agent Chat")).toBeInTheDocument();
  });

  it("marks the active tab with aria-selected=true", () => {
    render(<Topbar {...defaultProps({ activeId: "2" })} />);
    const tabs = screen.getAllByRole("tab");
    const activeTab = tabs.find((t) => t.getAttribute("aria-label") === "Agent Chat");
    expect(activeTab).toHaveAttribute("aria-selected", "true");
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(<Topbar {...defaultProps({ onClose })} />);

    // Close buttons are the spans with class topbar__tab-close
    const closeBtns = document.querySelectorAll(".topbar__tab-close");
    expect(closeBtns.length).toBe(2);

    fireEvent.click(closeBtns[0]);
    expect(onClose).toHaveBeenCalledWith("1");
  });

  it("calls onAdd when the add button is clicked", () => {
    const onAdd = vi.fn();
    render(<Topbar {...defaultProps({ onAdd })} />);

    const addBtn = screen.getByLabelText("New tab");
    fireEvent.click(addBtn);
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it("Home button reflects active state when homeOpen and settings closed", () => {
    render(<Topbar {...defaultProps({ homeOpen: true })} />);
    const homeBtn = screen.getByLabelText("Home");
    expect(homeBtn).toHaveAttribute("aria-pressed", "true");
  });
});
