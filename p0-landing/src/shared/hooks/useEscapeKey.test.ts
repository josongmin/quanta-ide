import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useEscapeKey } from "./useEscapeKey";

describe("useEscapeKey", () => {
  it("calls callback on Escape key when active", () => {
    const cb = vi.fn();
    renderHook(() => { useEscapeKey(true, cb); });
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(cb).toHaveBeenCalledOnce();
  });

  it("does not call callback when inactive", () => {
    const cb = vi.fn();
    renderHook(() => { useEscapeKey(false, cb); });
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(cb).not.toHaveBeenCalled();
  });

  it("ignores non-Escape keys", () => {
    const cb = vi.fn();
    renderHook(() => { useEscapeKey(true, cb); });
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(cb).not.toHaveBeenCalled();
  });
});
