import { render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useTabFocus } from "../use-tab-focus";

function Harness({ active, fn }: { active: boolean; fn: () => void }) {
  useTabFocus(active, fn);
  return null;
}

describe("useTabFocus", () => {
  it("fires on first mount when active", () => {
    const fn = vi.fn();
    render(<Harness active={true} fn={fn} />);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does not fire on first mount when inactive", () => {
    const fn = vi.fn();
    render(<Harness active={false} fn={fn} />);
    expect(fn).not.toHaveBeenCalled();
  });

  it("fires on every false → true transition", () => {
    const fn = vi.fn();
    const { rerender } = render(<Harness active={false} fn={fn} />);
    expect(fn).not.toHaveBeenCalled();

    rerender(<Harness active={true} fn={fn} />);
    expect(fn).toHaveBeenCalledTimes(1);

    rerender(<Harness active={false} fn={fn} />);
    expect(fn).toHaveBeenCalledTimes(1);

    rerender(<Harness active={true} fn={fn} />);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does not fire on true → false transitions", () => {
    const fn = vi.fn();
    const { rerender } = render(<Harness active={true} fn={fn} />);
    expect(fn).toHaveBeenCalledTimes(1);

    rerender(<Harness active={false} fn={fn} />);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does not fire on same-value re-renders", () => {
    const fn = vi.fn();
    const { rerender } = render(<Harness active={true} fn={fn} />);
    expect(fn).toHaveBeenCalledTimes(1);

    rerender(<Harness active={true} fn={fn} />);
    rerender(<Harness active={true} fn={fn} />);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("calls the LATEST fn at transition time (useEffectEvent semantics)", () => {
    // Prevents stale-closure bugs: a caller that passes a fresh fn on every
    // render must get the fresh fn invoked, not whatever identity was
    // captured at the transition's previous false render.
    const firstFn = vi.fn();
    const secondFn = vi.fn();

    const { rerender } = render(<Harness active={false} fn={firstFn} />);
    rerender(<Harness active={false} fn={secondFn} />);
    rerender(<Harness active={true} fn={secondFn} />);

    expect(firstFn).not.toHaveBeenCalled();
    expect(secondFn).toHaveBeenCalledTimes(1);
  });
});
