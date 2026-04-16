import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyPane } from "../empty-pane/EmptyPane";

describe("EmptyPane", () => {
  it("renders the label text", () => {
    render(<EmptyPane label="No items found" />);
    expect(screen.getByText("No items found")).toBeInTheDocument();
  });

  it("applies the empty-pane class", () => {
    const { container } = render(<EmptyPane label="Empty" />);
    expect(container.querySelector(".empty-pane")).toBeInTheDocument();
  });
});
