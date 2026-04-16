import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mock the PrPage to avoid pulling in the entire PR review tree.
// ---------------------------------------------------------------------------

vi.mock("@quanta/app-pr/pages/pr", () => ({
  PrPage: () => <div data-testid="pr-page">PR review content</div>,
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PrApp", () => {
  let PrApp: typeof import("../App").PrApp;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../App");
    PrApp = mod.PrApp;
  });

  it("renders without crashing", () => {
    const { container } = render(<PrApp tabId="t1" isActive />);
    expect(container).toBeTruthy();
  });

  it("contains PrPage content", () => {
    render(<PrApp tabId="t1" isActive />);
    expect(screen.getByTestId("pr-page")).toBeInTheDocument();
    expect(screen.getByText("PR review content")).toBeInTheDocument();
  });

  it("accepts tabId and isActive props without error", () => {
    const { container } = render(<PrApp tabId="pr-tab-99" isActive={false} />);
    expect(container.firstChild).toBeTruthy();
  });
});
