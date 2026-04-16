import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mock the ReviewsPage to avoid pulling in the full reviews tree.
// ---------------------------------------------------------------------------

vi.mock("@quanta/app-reviews/pages/reviews", () => ({
  ReviewsPage: () => <div data-testid="reviews-page">Reviews content</div>,
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ReviewsApp", () => {
  let ReviewsApp: typeof import("../App").ReviewsApp;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../App");
    ReviewsApp = mod.ReviewsApp;
  });

  it("renders without crashing", () => {
    const { container } = render(<ReviewsApp tabId="t1" isActive />);
    expect(container).toBeTruthy();
  });

  it("contains ReviewsPage content", () => {
    render(<ReviewsApp tabId="t1" isActive />);
    expect(screen.getByTestId("reviews-page")).toBeInTheDocument();
    expect(screen.getByText("Reviews content")).toBeInTheDocument();
  });

  it("renders with isActive=false", () => {
    const { container } = render(<ReviewsApp tabId="t2" isActive={false} />);
    expect(container.firstChild).toBeTruthy();
  });
});
