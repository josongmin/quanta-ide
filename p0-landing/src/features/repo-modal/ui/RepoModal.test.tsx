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

  it("switches repo when sidebar tab is clicked", async () => {
    const user = userEvent.setup();
    useRepoStore.setState({ current: "acme/payments-api" });
    useModalStore.setState({ isOpen: true });
    render(<RepoModal />);

    const tabs = screen.getAllByRole("button").filter(b => b.classList.contains("repo-modal-tab"));
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- textContent can be null per DOM spec
    const eventMeshTab = tabs.find(t => t.textContent?.includes("switchyard/event-mesh"));
    expect(eventMeshTab).toBeDefined();
    await user.click(eventMeshTab!);
    expect(useRepoStore.getState().current).toBe("switchyard/event-mesh");
  });

  it("expands question accordion on click", async () => {
    const user = userEvent.setup();
    useRepoStore.setState({ current: "acme/payments-api" });
    useModalStore.setState({ isOpen: true });
    render(<RepoModal />);

    const secondQuestion = screen.getByText("Who actually owns refund state?");
    await user.click(secondQuestion);
    expect(screen.getByText("Refund ownership is split across route, service, and ledger layers")).toBeInTheDocument();
  });

  it("toggles tree expansion", async () => {
    const user = userEvent.setup();
    useRepoStore.setState({ current: "acme/payments-api" });
    useModalStore.setState({ isOpen: true });
    render(<RepoModal />);

    const toggle = screen.getByText("Show more");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(screen.getByText("Show less")).toHaveAttribute("aria-expanded", "true");
  });

  it("renders complexity signals with tooltips", () => {
    useRepoStore.setState({ current: "acme/payments-api" });
    useModalStore.setState({ isOpen: true });
    render(<RepoModal />);
    const signal = screen.getByText("14-file webhook chain");
    expect(signal).toHaveAttribute("title");
  });

  it("renders meta stats with CountUp", () => {
    useRepoStore.setState({ current: "acme/payments-api" });
    useModalStore.setState({ isOpen: true });
    render(<RepoModal />);
    expect(screen.getByText("Files")).toBeInTheDocument();
    expect(screen.getByText("Lines")).toBeInTheDocument();
  });

  it("renders footer CTA buttons", () => {
    useModalStore.setState({ isOpen: true });
    render(<RepoModal />);
    expect(screen.getByText("Try hardest question")).toBeInTheDocument();
    expect(screen.getByText(/Analyze this repo/)).toBeInTheDocument();
  });

  it("closes on backdrop click", async () => {
    const user = userEvent.setup();
    useModalStore.setState({ isOpen: true });
    render(<RepoModal />);
    const backdrop = document.querySelector(".repo-modal-backdrop");
    expect(backdrop).toBeTruthy();
    await user.click(backdrop!);
    expect(useModalStore.getState().isOpen).toBe(false);
  });
});
