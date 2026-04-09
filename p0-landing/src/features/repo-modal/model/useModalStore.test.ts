import { describe, it, expect, beforeEach } from "vitest";
import { useModalStore } from "./useModalStore";

describe("useModalStore", () => {
  beforeEach(() => {
    useModalStore.setState({ isOpen: false });
  });

  it("starts closed", () => {
    expect(useModalStore.getState().isOpen).toBe(false);
  });

  it("opens", () => {
    useModalStore.getState().open();
    expect(useModalStore.getState().isOpen).toBe(true);
  });

  it("closes", () => {
    useModalStore.setState({ isOpen: true });
    useModalStore.getState().close();
    expect(useModalStore.getState().isOpen).toBe(false);
  });
});
