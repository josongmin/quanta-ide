import { useSyncExternalStore } from "react";

// ───────────────────────────────────────────────────────────────────
// Perf simulator — fakes lower-tier hardware on your dev box.
//
// Two knobs:
//   1. CPU throttle: busy-wait N ms at the top of each animation frame.
//      This steals budget from the real render, so a 6ms frame becomes
//      (6 + N)ms. It's the same signal real low-end CPUs produce — the
//      main thread loses time to other work — and it degrades *all*
//      downstream work (React, Pixi, our handlers) uniformly.
//   2. Memory pressure: hold N MB of ArrayBuffers. Forces V8 to run
//      under pressure and exercises GC pauses the way a repo 2-3× the
//      size would. No effect on GPU-side state.
//
// Both are off by default. The UI (SimulatorSection) is the only caller
// of the setters. We install one self-looping RAF when the first
// subscriber mounts and never tear it down — the cost when off is one
// function call per frame.
// ───────────────────────────────────────────────────────────────────

export type CpuPreset = "off" | "light" | "medium" | "heavy";
export type MemPreset = "off" | "200mb" | "500mb" | "1gb";

export interface SimulatorState {
  cpuPreset: CpuPreset;
  memPreset: MemPreset;
  cpuBurnMs: number;     // derived from cpuPreset
  memBytes: number;      // derived from memPreset
  lastBurnMs: number;    // actual wall-clock ms spent burning this frame
}

const CPU_MS: Record<CpuPreset, number> = {
  off: 0,
  light: 6,     // ≈ M1 Air feel on 10k-file repo
  medium: 12,   // ≈ mid-tier Intel laptop from 2021
  heavy: 20,    // ≈ 5-year-old i5 laptop / ChromeBook
};

const MEM_BYTES: Record<MemPreset, number> = {
  off: 0,
  "200mb": 200 * 1024 * 1024,
  "500mb": 500 * 1024 * 1024,
  "1gb": 1024 * 1024 * 1024,
};

let state: SimulatorState = {
  cpuPreset: "off",
  memPreset: "off",
  cpuBurnMs: 0,
  memBytes: 0,
  lastBurnMs: 0,
};
const listeners = new Set<() => void>();
const emit = (): void => { for (const l of [...listeners]) l(); };

// Memory-pressure buffer. Kept outside `state` so React subscribers don't
// accidentally snapshot gigabytes every selector call.
let ballast: ArrayBuffer[] = [];
function setBallast(bytes: number): void {
  ballast = [];
  if (bytes <= 0) return;
  // Allocate in 16MB chunks so each new() call is tractable for V8.
  const CHUNK = 16 * 1024 * 1024;
  for (let remaining = bytes; remaining > 0; remaining -= CHUNK) {
    ballast.push(new ArrayBuffer(Math.min(CHUNK, remaining)));
  }
}

// Self-looping RAF that burns CPU at the top of every frame when armed.
// Installed lazily so the simulator is zero-cost until someone turns it on.
let rafInstalled = false;
let rafId = 0;
let ewmaBurn = 0;
function ensureRafInstalled(): void {
  if (rafInstalled) return;
  rafInstalled = true;
  const tick = () => {
    const burnMs = state.cpuBurnMs;
    if (burnMs > 0) {
      const t0 = performance.now();
      // Busy-wait. Intentionally blocks the main thread — that's the
      // whole point. Checking `now - t0` in a tight loop costs ~50ns/iter
      // on modern hardware, which is noise compared to the ms-scale burn.
      while (performance.now() - t0 < burnMs) {
        // spin
      }
      const actual = performance.now() - t0;
      // EWMA so the UI readout isn't a noisy per-frame value.
      ewmaBurn = ewmaBurn * 0.9 + actual * 0.1;
      if (Math.abs(ewmaBurn - state.lastBurnMs) > 0.5) {
        state = { ...state, lastBurnMs: ewmaBurn };
        emit();
      }
    } else if (state.lastBurnMs !== 0) {
      state = { ...state, lastBurnMs: 0 };
      ewmaBurn = 0;
      emit();
    }
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
}

export const perfSimulator = {
  getState: (): SimulatorState => state,

  subscribe(listener: () => void): () => void {
    ensureRafInstalled();
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },

  setCpuPreset(preset: CpuPreset): void {
    if (state.cpuPreset === preset) return;
    state = { ...state, cpuPreset: preset, cpuBurnMs: CPU_MS[preset] };
    emit();
  },

  setMemPreset(preset: MemPreset): void {
    if (state.memPreset === preset) return;
    const bytes = MEM_BYTES[preset];
    setBallast(bytes);
    state = { ...state, memPreset: preset, memBytes: bytes };
    emit();
  },

  /** Reset everything to off. Useful when closing the HUD. */
  reset(): void {
    setBallast(0);
    state = { cpuPreset: "off", memPreset: "off", cpuBurnMs: 0, memBytes: 0, lastBurnMs: 0 };
    ewmaBurn = 0;
    emit();
  },

  /** Stop the RAF loop — only used by tests. */
  _teardown(): void {
    if (rafInstalled) {
      cancelAnimationFrame(rafId);
      rafInstalled = false;
      rafId = 0;
    }
    setBallast(0);
    state = { cpuPreset: "off", memPreset: "off", cpuBurnMs: 0, memBytes: 0, lastBurnMs: 0 };
    ewmaBurn = 0;
    listeners.clear();
  },
};

export function usePerfSimulator<T>(selector: (s: SimulatorState) => T): T {
  return useSyncExternalStore(
    perfSimulator.subscribe,
    () => selector(perfSimulator.getState()),
    () => selector(perfSimulator.getState()),
  );
}
