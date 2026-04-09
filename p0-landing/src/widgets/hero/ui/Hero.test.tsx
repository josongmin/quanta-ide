import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Hero } from "./Hero";

describe("Hero", () => {
  it("renders headline", () => {
    render(<Hero />);
    expect(screen.getByText(/Stop explaining your codebase/)).toBeInTheDocument();
  });

  it("renders sub copy", () => {
    render(<Hero />);
    expect(screen.getByText(/Every other agent starts from a blank slate/)).toBeInTheDocument();
  });

  it("renders repo select trigger", () => {
    render(<Hero />);
    expect(screen.getByText("Stress test p0 on")).toBeInTheDocument();
    expect(screen.getByText("acme/payments-api")).toBeInTheDocument();
  });
});
