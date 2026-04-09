import { describe, it, expect, beforeEach } from "vitest";
import { useRepoStore } from "./useRepoStore";

describe("useRepoStore", () => {
  beforeEach(() => {
    useRepoStore.setState({ current: "acme/payments-api" });
  });

  it("has correct initial state", () => {
    expect(useRepoStore.getState().current).toBe("acme/payments-api");
  });

  it("updates current repo", () => {
    useRepoStore.getState().setCurrent("switchyard/event-mesh");
    expect(useRepoStore.getState().current).toBe("switchyard/event-mesh");
  });
});
