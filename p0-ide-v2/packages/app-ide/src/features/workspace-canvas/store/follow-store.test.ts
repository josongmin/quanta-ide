import { describe, it, expect, beforeEach } from "vitest";
import { followStore } from "./follow-store";

describe("follow-store", () => {
  beforeEach(() => {
    followStore.stop();
  });

  it("starts with null target", () => {
    expect(followStore.getState().targetUserId).toBeNull();
  });

  it("start sets targetUserId and short-circuits on same value", () => {
    let ticks = 0;
    const unsub = followStore.subscribe(() => { ticks += 1; });
    followStore.start("alice");
    expect(followStore.getState().targetUserId).toBe("alice");
    expect(ticks).toBe(1);
    followStore.start("alice");
    expect(ticks).toBe(1);
    unsub();
  });

  it("stop on already-stopped is a no-op (no emit)", () => {
    let ticks = 0;
    const unsub = followStore.subscribe(() => { ticks += 1; });
    followStore.stop();
    expect(ticks).toBe(0);
    unsub();
  });

  it("toggle starts if different, stops if same", () => {
    followStore.toggle("bob");
    expect(followStore.getState().targetUserId).toBe("bob");
    followStore.toggle("bob");
    expect(followStore.getState().targetUserId).toBeNull();
    followStore.toggle("bob");
    followStore.toggle("alice");
    expect(followStore.getState().targetUserId).toBe("alice");
  });
});
