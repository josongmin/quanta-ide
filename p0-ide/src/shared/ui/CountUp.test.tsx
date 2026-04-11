import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { CountUp } from "./CountUp";

describe("CountUp", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the initial value", async () => {
    render(<CountUp value="42" />);
    await waitFor(() => {
      expect(screen.getByText("42")).toBeInTheDocument();
    });
  });

  it("renders value with suffix", async () => {
    render(<CountUp value="1,284 files" />);
    await waitFor(() => {
      expect(screen.getByText("1,284 files")).toBeInTheDocument();
    });
  });

  it("renders non-numeric value as-is", async () => {
    render(<CountUp value="N/A" />);
    await waitFor(() => {
      expect(screen.getByText("N/A")).toBeInTheDocument();
    });
  });

  it("animates from old to new numeric value", async () => {
    const { rerender } = render(<CountUp value="10" duration={0.05} />);
    await waitFor(() => {
      expect(screen.getByText("10")).toBeInTheDocument();
    });

    rerender(<CountUp value="20" duration={0.05} />);
    await waitFor(
      () => {
        expect(screen.getByText("20")).toBeInTheDocument();
      },
      { timeout: 4000 },
    );
  });

  it("handles same value without animating", async () => {
    const { rerender } = render(<CountUp value="42" />);
    rerender(<CountUp value="42" />);
    await waitFor(() => {
      expect(screen.getByText("42")).toBeInTheDocument();
    });
  });

  it("handles decimal values", async () => {
    render(<CountUp value="3.14 ratio" />);
    await waitFor(() => {
      expect(screen.getByText("3.14 ratio")).toBeInTheDocument();
    });
  });
});
