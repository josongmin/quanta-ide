import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mock the ScenarioPage to isolate ScenarioApp.
// ---------------------------------------------------------------------------

vi.mock("@quanta/app-scenario/pages/scenario", () => ({
  ScenarioPage: () => <div data-testid="scenario-page">Scenario content</div>,
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ScenarioApp", () => {
  let ScenarioApp: typeof import("../App").ScenarioApp;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../App");
    ScenarioApp = mod.ScenarioApp;
  });

  it("renders without crashing", () => {
    const { container } = render(<ScenarioApp tabId="t1" isActive />);
    expect(container).toBeTruthy();
  });

  it("contains ScenarioPage content", () => {
    render(<ScenarioApp tabId="t1" isActive />);
    expect(screen.getByTestId("scenario-page")).toBeInTheDocument();
    expect(screen.getByText("Scenario content")).toBeInTheDocument();
  });
});
