import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  isCmdE,
  isCmdK,
  isCmdShiftT,
  useGlobalKeybinds,
  type GlobalKeybind,
} from "./use-keyboard-shortcuts";

function ev(init: KeyboardEventInit, target?: EventTarget | null): KeyboardEvent {
  const e = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
  if (target) Object.defineProperty(e, "target", { value: target, configurable: true });
  return e;
}

describe("keyboard shortcut predicates", () => {
  it("isCmdK matches meta+K and ctrl+K, rejects shift/alt variants", () => {
    expect(isCmdK(ev({ key: "k", metaKey: true }))).toBe(true);
    expect(isCmdK(ev({ key: "K", ctrlKey: true }))).toBe(true);
    expect(isCmdK(ev({ key: "k" }))).toBe(false);
    expect(isCmdK(ev({ key: "k", metaKey: true, shiftKey: true }))).toBe(false);
    expect(isCmdK(ev({ key: "k", metaKey: true, altKey: true }))).toBe(false);
  });

  it("isCmdShiftT requires both modifiers", () => {
    expect(isCmdShiftT(ev({ key: "t", metaKey: true, shiftKey: true }))).toBe(true);
    expect(isCmdShiftT(ev({ key: "T", ctrlKey: true, shiftKey: true }))).toBe(true);
    expect(isCmdShiftT(ev({ key: "t", metaKey: true }))).toBe(false);
    expect(isCmdShiftT(ev({ key: "t", shiftKey: true }))).toBe(false);
  });

  it("isCmdE matches only plain meta/ctrl+E", () => {
    expect(isCmdE(ev({ key: "e", metaKey: true }))).toBe(true);
    expect(isCmdE(ev({ key: "E", ctrlKey: true }))).toBe(true);
    expect(isCmdE(ev({ key: "e", metaKey: true, shiftKey: true }))).toBe(false);
  });
});

describe("useGlobalKeybinds", () => {
  it("fires handler when predicate matches and calls preventDefault by default", () => {
    const handler = vi.fn();
    const binding: GlobalKeybind = {
      label: "palette",
      match: isCmdK,
      handler,
    };
    const { unmount } = renderHook(() => useGlobalKeybinds([binding]));
    const e = ev({ key: "k", metaKey: true });
    window.dispatchEvent(e);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(e.defaultPrevented).toBe(true);
    unmount();
  });

  it("does NOT fire when target is an INPUT element (unless fireInEditable)", () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() =>
      useGlobalKeybinds([{ label: "x", match: isCmdK, handler }]),
    );
    const input = document.createElement("input");
    document.body.appendChild(input);
    window.dispatchEvent(ev({ key: "k", metaKey: true }, input));
    expect(handler).not.toHaveBeenCalled();
    document.body.removeChild(input);
    unmount();
  });

  it("fires in editable targets when fireInEditable=true", () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() =>
      useGlobalKeybinds([{ label: "x", match: isCmdK, handler, fireInEditable: true }]),
    );
    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);
    window.dispatchEvent(ev({ key: "k", metaKey: true }, textarea));
    expect(handler).toHaveBeenCalledTimes(1);
    document.body.removeChild(textarea);
    unmount();
  });

  it("skips non-matching bindings and hits the first match only", () => {
    const handlerA = vi.fn();
    const handlerB = vi.fn();
    const { unmount } = renderHook(() =>
      useGlobalKeybinds([
        { label: "a", match: isCmdE, handler: handlerA },
        { label: "b", match: isCmdK, handler: handlerB },
      ]),
    );
    window.dispatchEvent(ev({ key: "k", metaKey: true }));
    expect(handlerA).not.toHaveBeenCalled();
    expect(handlerB).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("unmount removes the listener", () => {
    const handler = vi.fn();
    const { unmount } = renderHook(() =>
      useGlobalKeybinds([{ label: "x", match: isCmdK, handler }]),
    );
    unmount();
    window.dispatchEvent(ev({ key: "k", metaKey: true }));
    expect(handler).not.toHaveBeenCalled();
  });
});
