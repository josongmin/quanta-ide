import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { type RefObject } from "react";
import { useClickOutside } from "./useClickOutside";

describe("useClickOutside", () => {
  it("calls callback when clicking outside ref element", () => {
    const cb = vi.fn();
    const el = document.createElement("div");
    document.body.appendChild(el);
    const ref = { current: el } as RefObject<HTMLElement>;

    renderHook(() => { useClickOutside(ref, true, cb); });
    document.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(cb).toHaveBeenCalledOnce();

    document.body.removeChild(el);
  });

  it("does not call callback when clicking inside ref element", () => {
    const cb = vi.fn();
    const el = document.createElement("div");
    document.body.appendChild(el);
    const ref = { current: el } as RefObject<HTMLElement>;

    renderHook(() => { useClickOutside(ref, true, cb); });

    const innerClick = new MouseEvent("click", { bubbles: true });
    Object.defineProperty(innerClick, "target", { value: el });
    el.dispatchEvent(innerClick);
    expect(cb).not.toHaveBeenCalled();

    document.body.removeChild(el);
  });

  it("does not call callback when inactive", () => {
    const cb = vi.fn();
    const el = document.createElement("div");
    const ref = { current: el } as RefObject<HTMLElement>;

    renderHook(() => { useClickOutside(ref, false, cb); });
    document.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(cb).not.toHaveBeenCalled();
  });
});
