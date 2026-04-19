import { describe, it, expect, beforeEach } from "vitest";
import { timerStore, formatMmSs } from "./timer-store";

describe("timer-store", () => {
  beforeEach(() => {
    timerStore.setDuration(15 * 60);
  });

  it("setDuration clamps to [1, 6h]", () => {
    timerStore.setDuration(0);
    expect(timerStore.getState().initialSec).toBe(1);
    timerStore.setDuration(60 * 60 * 10);
    expect(timerStore.getState().initialSec).toBe(60 * 60 * 6);
    timerStore.setDuration(300);
    expect(timerStore.getState().initialSec).toBe(300);
    expect(timerStore.getState().remainingSec).toBe(300);
  });

  it("start/pause toggle the running flag; pause is a no-op when idle", () => {
    timerStore.start();
    expect(timerStore.getState().running).toBe(true);
    let ticks = 0;
    const unsub = timerStore.subscribe(() => { ticks += 1; });
    timerStore.start();
    expect(ticks).toBe(0);
    timerStore.pause();
    expect(timerStore.getState().running).toBe(false);
    timerStore.pause();
    expect(ticks).toBe(1);
    unsub();
  });

  it("tick does nothing when not running", () => {
    timerStore.tick(5);
    expect(timerStore.getState().remainingSec).toBe(15 * 60);
  });

  it("tick to zero stops timer and increments finishedCount", () => {
    timerStore.setDuration(3);
    timerStore.start();
    timerStore.tick(1);
    expect(timerStore.getState().remainingSec).toBe(2);
    timerStore.tick(10);
    const s = timerStore.getState();
    expect(s.remainingSec).toBe(0);
    expect(s.running).toBe(false);
    expect(s.finishedCount).toBe(1);
  });

  it("start auto-resets to initialSec when called at zero", () => {
    timerStore.setDuration(2);
    timerStore.start();
    timerStore.tick(5);
    expect(timerStore.getState().remainingSec).toBe(0);
    timerStore.start();
    expect(timerStore.getState().remainingSec).toBe(2);
    expect(timerStore.getState().running).toBe(true);
  });

  it("formatMmSs pads zero and clamps negatives", () => {
    expect(formatMmSs(65)).toBe("01:05");
    expect(formatMmSs(-5)).toBe("00:00");
    expect(formatMmSs(600)).toBe("10:00");
  });
});
