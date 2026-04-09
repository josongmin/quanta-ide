import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PromptCard } from "./PromptCard";

describe("PromptCard", () => {
  it("renders textarea with placeholder", () => {
    render(<PromptCard />);
    expect(screen.getByPlaceholderText("What native mobile app shall we design?")).toBeInTheDocument();
  });

  it("renders App and Web tab buttons", () => {
    render(<PromptCard />);
    expect(screen.getByText("App")).toBeInTheDocument();
    expect(screen.getByText("Web")).toBeInTheDocument();
  });

  it("renders submit button", () => {
    render(<PromptCard />);
    expect(screen.getByTitle("Submit")).toBeInTheDocument();
  });

  it("renders toolbar icon buttons", () => {
    render(<PromptCard />);
    expect(screen.getByTitle("Attach")).toBeInTheDocument();
    expect(screen.getByTitle("Tone")).toBeInTheDocument();
    expect(screen.getByTitle("Options")).toBeInTheDocument();
  });

  it("allows typing in textarea", async () => {
    const user = userEvent.setup();
    render(<PromptCard />);
    const textarea = screen.getByPlaceholderText("What native mobile app shall we design?");
    await user.type(textarea, "Build a todo app");
    expect(textarea).toHaveValue("Build a todo app");
  });

  it("textarea has aria-label", () => {
    render(<PromptCard />);
    expect(screen.getByLabelText("Design prompt")).toBeInTheDocument();
  });
});
