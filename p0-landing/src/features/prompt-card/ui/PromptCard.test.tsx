import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
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
});
