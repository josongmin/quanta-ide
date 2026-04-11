import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useEscapeKey } from "./useEscapeKey";

describe("useEscapeKey", () => {
  it("calls callback on Escape key when active", async () => {
    const cb = vi.fn();
    renderHook(() => { useEscapeKey(true, cb); });
    await act(async () => { await Promise.resolve(); });
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(cb).toHaveBeenCalledOnce();
  });

  it("does not call callback when inactive", async () => {
    const cb = vi.fn();
    renderHook(() => { useEscapeKey(false, cb); });
    await act(async () => { await Promise.resolve(); });
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(cb).not.toHaveBeenCalled();
  });

  it("ignores non-Escape keys", async () => {
    const cb = vi.fn();
    renderHook(() => { useEscapeKey(true, cb); });
    await act(async () => { await Promise.resolve(); });
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    expect(cb).not.toHaveBeenCalled();
  });
});
