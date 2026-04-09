import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRepoStore } from "@/entities/repo/model/useRepoStore";
import { useModalStore } from "../model/useModalStore";
import { RepoModal } from "./RepoModal";

describe("RepoModal", () => {
  it("renders nothing when closed", () => {
    useModalStore.setState({ isOpen: false });
    const { container } = render(<RepoModal />);
    expect(container.innerHTML).toBe("");
  });

  it("renders modal content when open", () => {
    useRepoStore.setState({ current: "acme/payments-api" });
    useModalStore.setState({ isOpen: true });
    render(<RepoModal />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Sample repos")).toBeInTheDocument();
  });

  it("shows repo details when open", () => {
    useRepoStore.setState({ current: "acme/payments-api" });
    useModalStore.setState({ isOpen: true });
    render(<RepoModal />);
    expect(screen.getAllByText("acme/payments-api").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Legacy Monolith").length).toBeGreaterThan(0);
  });

  it("renders close button", () => {
    useModalStore.setState({ isOpen: true });
    render(<RepoModal />);
    expect(screen.getByLabelText("Close")).toBeInTheDocument();
  });

  it("renders question seeds", () => {
    useModalStore.setState({ isOpen: true });
    useRepoStore.setState({ current: "acme/payments-api" });
    render(<RepoModal />);
    expect(screen.getAllByText("Which path can double-refund a customer?").length).toBeGreaterThan(0);
  });

  it("closes modal on close button click", async () => {
    const user = userEvent.setup();
    useModalStore.setState({ isOpen: true });
    render(<RepoModal />);
    await user.click(screen.getByLabelText("Close"));
    expect(useModalStore.getState().isOpen).toBe(false);
  });
});
