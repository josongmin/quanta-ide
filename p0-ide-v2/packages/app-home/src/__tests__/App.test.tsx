import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mock page components to isolate HomeApp and NewTabApp.
// ---------------------------------------------------------------------------

vi.mock("@quanta/app-home/pages/home", () => ({
  HomePage: () => <div data-testid="home-page">Home content</div>,
}));

vi.mock("@quanta/app-home/pages/new-tab", () => ({
  NewTabPage: () => <div data-testid="new-tab-page">New tab content</div>,
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("HomeApp", () => {
  let HomeApp: typeof import("../App").HomeApp;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../App");
    HomeApp = mod.HomeApp;
  });

  it("renders without crashing", () => {
    const { container } = render(<HomeApp tabId="t1" isActive />);
    expect(container).toBeTruthy();
  });

  it("contains HomePage content", () => {
    render(<HomeApp tabId="t1" isActive />);
    expect(screen.getByTestId("home-page")).toBeInTheDocument();
    expect(screen.getByText("Home content")).toBeInTheDocument();
  });
});

describe("NewTabApp", () => {
  let NewTabApp: typeof import("../App").NewTabApp;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../App");
    NewTabApp = mod.NewTabApp;
  });

  it("renders without crashing", () => {
    const { container } = render(<NewTabApp tabId="t1" isActive />);
    expect(container).toBeTruthy();
  });
});
