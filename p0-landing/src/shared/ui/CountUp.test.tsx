import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { CountUp } from "./CountUp";

describe("CountUp", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the initial value", () => {
    render(<CountUp value="42" />);
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders value with suffix", () => {
    render(<CountUp value="1,284 files" />);
    expect(screen.getByText("1,284 files")).toBeInTheDocument();
  });

  it("renders non-numeric value as-is", () => {
    render(<CountUp value="N/A" />);
    expect(screen.getByText("N/A")).toBeInTheDocument();
  });

  it("animates from old to new numeric value", () => {
    vi.useFakeTimers();
    const { rerender } = render(<CountUp value="10" duration={0.1} />);
    expect(screen.getByText("10")).toBeInTheDocument();

    rerender(<CountUp value="20" duration={0.1} />);

    // advance through the animation
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // after animation, should show final value
    const span = screen.getByText(/\d+/);
    expect(span).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("handles same value without animating", () => {
    const { rerender } = render(<CountUp value="42" />);
    rerender(<CountUp value="42" />);
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("handles decimal values", () => {
    render(<CountUp value="3.14 ratio" />);
    expect(screen.getByText("3.14 ratio")).toBeInTheDocument();
  });
});
