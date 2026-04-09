import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuroraPicker } from "./AuroraPicker";

describe("AuroraPicker", () => {
  it("renders trigger button", () => {
    render(<AuroraPicker />);
    expect(screen.getByText("Palette")).toBeInTheDocument();
  });

  it("shows palette options on click", async () => {
    const user = userEvent.setup();
    render(<AuroraPicker />);
    await user.click(screen.getByText("Palette"));
    expect(screen.getByText("Choose palette")).toBeInTheDocument();
    expect(screen.getByText("Violet")).toBeInTheDocument();
    expect(screen.getByText("Ocean")).toBeInTheDocument();
  });
});
