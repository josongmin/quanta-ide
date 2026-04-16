import { describe, it, expect, vi, beforeEach } from "vitest";
import { focusManager } from "../focus-manager";

describe("focusManager", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("save/restore cycle restores focus to the previously active element", () => {
    const btn = document.createElement("button");
    btn.textContent = "Focus me";
    document.body.appendChild(btn);
    btn.focus();
    expect(document.activeElement).toBe(btn);

    focusManager.save();

    // Move focus elsewhere.
    const other = document.createElement("input");
    document.body.appendChild(other);
    other.focus();
    expect(document.activeElement).toBe(other);

    focusManager.restore();
    expect(document.activeElement).toBe(btn);
  });

  it("supports nested save/restore (stack behaviour)", () => {
    const btn1 = document.createElement("button");
    const btn2 = document.createElement("button");
    document.body.appendChild(btn1);
    document.body.appendChild(btn2);

    btn1.focus();
    focusManager.save(); // stack: [btn1]

    btn2.focus();
    focusManager.save(); // stack: [btn1, btn2]

    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    focusManager.restore(); // pop btn2
    expect(document.activeElement).toBe(btn2);

    focusManager.restore(); // pop btn1
    expect(document.activeElement).toBe(btn1);
  });

  it("restore is a no-op when the stack is empty", () => {
    const btn = document.createElement("button");
    document.body.appendChild(btn);
    btn.focus();

    // Should not throw.
    focusManager.restore();
    // Focus remains unchanged — no crash.
    expect(document.activeElement).toBe(btn);
  });

  it("trap returns a disposer that removes the keydown listener", () => {
    const container = document.createElement("div");
    const btn = document.createElement("button");
    container.appendChild(btn);
    document.body.appendChild(container);

    const spy = vi.spyOn(container, "removeEventListener");

    const dispose = focusManager.trap(container);
    expect(typeof dispose).toBe("function");

    dispose();
    expect(spy).toHaveBeenCalledWith("keydown", expect.any(Function));

    spy.mockRestore();
  });
});
