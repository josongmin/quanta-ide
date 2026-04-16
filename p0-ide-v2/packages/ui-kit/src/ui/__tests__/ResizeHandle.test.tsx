import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ResizeHandle } from "../resize-handle/ResizeHandle";

describe("ResizeHandle", () => {
  it("renders with role=separator and correct aria attributes", () => {
    render(<ResizeHandle onResize={vi.fn()} ariaLabel="Resize panel" />);
    const el = screen.getByRole("separator");
    expect(el).toBeInTheDocument();
    expect(el).toHaveAttribute("aria-label", "Resize panel");
    expect(el).toHaveAttribute("aria-orientation", "vertical");
  });

  it("applies horizontal orientation class when specified", () => {
    render(
      <ResizeHandle onResize={vi.fn()} ariaLabel="Resize height" orientation="horizontal" />,
    );
    const el = screen.getByRole("separator");
    expect(el).toHaveClass("resize-handle--horizontal");
    expect(el).toHaveAttribute("aria-orientation", "horizontal");
  });

  it("fires onResize with delta during pointer drag (vertical)", () => {
    const onResize = vi.fn();
    render(<ResizeHandle onResize={onResize} ariaLabel="Resize" />);
    const el = screen.getByRole("separator");

    // Simulate pointer down at x=100
    fireEvent.pointerDown(el, { clientX: 100, clientY: 50 });

    // Simulate pointer move to x=120 (delta = +20)
    fireEvent(
      window,
      new PointerEvent("pointermove", { clientX: 120, clientY: 50, bubbles: true }),
    );
    expect(onResize).toHaveBeenCalledWith(20);

    // Simulate pointer up
    fireEvent(window, new PointerEvent("pointerup", { bubbles: true }));

    // Further moves should not trigger onResize
    onResize.mockClear();
    fireEvent(
      window,
      new PointerEvent("pointermove", { clientX: 140, clientY: 50, bubbles: true }),
    );
    expect(onResize).not.toHaveBeenCalled();
  });
});
