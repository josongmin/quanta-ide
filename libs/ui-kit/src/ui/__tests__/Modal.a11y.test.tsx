import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { Modal } from "../modal/Modal";

expect.extend(toHaveNoViolations);

describe("Modal — a11y (axe-core)", () => {
  it("has no a11y violations when open", async () => {
    const { container } = render(
      <Modal open onClose={vi.fn()} labelledBy="modal-title">
        <h2 id="modal-title">Test Modal</h2>
        <p>Modal content</p>
      </Modal>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("has no a11y violations when closed", async () => {
    const { container } = render(
      <Modal open={false} onClose={vi.fn()}>
        <p>Hidden</p>
      </Modal>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("has no a11y violations with size variants", async () => {
    for (const size of ["sm", "lg", "fit"] as const) {
      const { container } = render(
        <Modal open onClose={vi.fn()} size={size} labelledBy="sized-title">
          <h2 id="sized-title">Sized Modal</h2>
        </Modal>,
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    }
  });
});
