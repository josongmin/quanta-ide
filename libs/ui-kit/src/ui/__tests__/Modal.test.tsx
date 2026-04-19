import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Modal } from "../modal/Modal";

describe("Modal", () => {
  it("renders children when open", () => {
    render(
      <Modal open onClose={vi.fn()}>
        <p>Hello Modal</p>
      </Modal>,
    );
    expect(screen.getByText("Hello Modal")).toBeInTheDocument();
  });

  it("returns null when closed", () => {
    const { container } = render(
      <Modal open={false} onClose={vi.fn()}>
        <p>Hidden</p>
      </Modal>,
    );
    expect(screen.queryByText("Hidden")).not.toBeInTheDocument();
    // The component itself returns null, so nothing from the modal appears.
    expect(container.innerHTML).toBe("");
  });

  it("has role=dialog and aria-modal=true", () => {
    render(
      <Modal open onClose={vi.fn()}>
        <p>Accessible</p>
      </Modal>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("calls onClose when Escape is pressed", () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose}>
        <p>Escape test</p>
      </Modal>,
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when backdrop is clicked", () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose}>
        <p>Backdrop test</p>
      </Modal>,
    );

    // The backdrop is the outer div with class ide-modal-backdrop.
    const backdrop = document.querySelector(".ide-modal-backdrop")!;
    fireEvent.mouseDown(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not call onClose when the modal content is clicked", () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose}>
        <p>Content click</p>
      </Modal>,
    );

    fireEvent.mouseDown(screen.getByText("Content click"));
    expect(onClose).not.toHaveBeenCalled();
  });
});
