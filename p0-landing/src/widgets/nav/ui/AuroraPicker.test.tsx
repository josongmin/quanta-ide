import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useThemeStore } from "@/entities/theme/model/useThemeStore";
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

  it("selects a palette option", async () => {
    const user = userEvent.setup();
    render(<AuroraPicker />);
    await user.click(screen.getByText("Palette"));
    await user.click(screen.getByText("Ocean"));
    expect(useThemeStore.getState().aurora).toBe("ocean");
  });

  it("closes panel after selecting", async () => {
    const user = userEvent.setup();
    render(<AuroraPicker />);
    const trigger = screen.getByRole("button", { name: /palette/i });
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    await user.click(screen.getByText("Emerald"));
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("has aria-expanded attribute on trigger", () => {
    render(<AuroraPicker />);
    const trigger = screen.getByRole("button", { name: /palette/i });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("renders all preset options", async () => {
    const user = userEvent.setup();
    render(<AuroraPicker />);
    await user.click(screen.getByText("Palette"));
    const options = screen.getAllByRole("option");
    expect(options.length).toBe(22);
  });

  it("marks active option with aria-selected", async () => {
    const user = userEvent.setup();
    useThemeStore.setState({ aurora: "violet" });
    render(<AuroraPicker />);
    await user.click(screen.getByText("Palette"));
    const violetOption = screen.getByRole("option", { name: /violet/i });
    expect(violetOption).toHaveAttribute("aria-selected", "true");
  });
});
