import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { App } from "./App";

describe("App", () => {
  it("renders without crashing", () => {
    render(<App />);
    expect(screen.getByText(/p0 Labs/)).toBeInTheDocument();
  });

  it("renders main sections", () => {
    render(<App />);
    expect(screen.getByText(/Stop explaining your codebase/)).toBeInTheDocument();
    expect(screen.getByText("Contact us")).toBeInTheDocument();
  });
});
