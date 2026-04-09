import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CountUp } from "./CountUp";

describe("CountUp", () => {
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
});
