import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";

expect.extend(toHaveNoViolations);

// ---------------------------------------------------------------------------
// Mock stores and hooks used by Topbar
// ---------------------------------------------------------------------------

vi.mock("@quanta/shell/stores/ui-bus", () => ({
  uiBus: {
    toggleSettings: vi.fn(),
    togglePalette: vi.fn(),
  },
  useUiBus: () => false, // settingsOpen = false
}));

vi.mock("boring-avatars", () => ({
  default: ({ name }: { name: string }) => (
    <svg role="img" aria-label={name} data-testid="avatar">
      <rect width="20" height="20" />
    </svg>
  ),
}));

vi.mock("../topbar/model/use-workspace-tab-strip", () => ({
  useWorkspaceTabStrip: () => ({
    stripRef: { current: null },
    onStripMouseLeave: vi.fn(),
    beginCloseTab: vi.fn(),
    tabChrome: (_id: string, isActive: boolean) => ({
      className: "topbar__tab" + (isActive ? " is-active" : ""),
      style: undefined,
      innerStyle: undefined,
    }),
  }),
}));

// ---------------------------------------------------------------------------
// Import Topbar after mocks
// ---------------------------------------------------------------------------

import { Topbar, type Tab } from "../topbar/ui/Topbar";

const SAMPLE_TABS: Tab[] = [
  { id: "t1", app: "ide", label: "orchestrator.py" },
  { id: "t2", app: "agent", label: "Agent Session" },
];

describe("Topbar — a11y (axe-core)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("has no a11y violations with tabs", async () => {
    const { container } = render(
      <Topbar
        tabs={SAMPLE_TABS}
        activeId="t1"
        onSelect={vi.fn()}
        onClose={vi.fn()}
        onAdd={vi.fn()}
        homeOpen={false}
        onToggleHome={vi.fn()}
      />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("has no a11y violations with home active", async () => {
    const { container } = render(
      <Topbar
        tabs={SAMPLE_TABS}
        activeId="t1"
        onSelect={vi.fn()}
        onClose={vi.fn()}
        onAdd={vi.fn()}
        homeOpen={true}
        onToggleHome={vi.fn()}
      />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("has no a11y violations with empty tabs", async () => {
    const { container } = render(
      <Topbar
        tabs={[]}
        activeId=""
        onSelect={vi.fn()}
        onClose={vi.fn()}
        onAdd={vi.fn()}
        homeOpen={false}
        onToggleHome={vi.fn()}
      />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
