import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mock the AgentPage to avoid pulling in the entire chat/session tree.
// ---------------------------------------------------------------------------

vi.mock("@quanta/app-agent/pages/agent", () => ({
  AgentPage: () => <div data-testid="agent-page">Agent content</div>,
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AgentApp", () => {
  let AgentApp: typeof import("../App").AgentApp;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../App");
    AgentApp = mod.AgentApp;
  });

  it("renders without crashing", () => {
    const { container } = render(<AgentApp tabId="t1" isActive />);
    expect(container).toBeTruthy();
  });

  it("contains AgentPage content", () => {
    render(<AgentApp tabId="t1" isActive />);
    expect(screen.getByTestId("agent-page")).toBeInTheDocument();
    expect(screen.getByText("Agent content")).toBeInTheDocument();
  });
});
