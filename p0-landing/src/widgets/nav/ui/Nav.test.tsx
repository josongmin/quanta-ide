import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Nav } from "./Nav";

describe("Nav", () => {
  it("renders logo text", () => {
    render(<Nav />);
    expect(screen.getByText(/p0 Labs/)).toBeInTheDocument();
  });

  it("renders BETA badge", () => {
    render(<Nav />);
    expect(screen.getByText("BETA")).toBeInTheDocument();
  });

  it("renders Contact us button", () => {
    render(<Nav />);
    expect(screen.getByText("Contact us")).toBeInTheDocument();
  });
});
