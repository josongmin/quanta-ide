// Per-file cost/latency overlay — mirrors what Sentry Performance surfaces on
// the file view and what Datadog's Service Map paints as a heatmap.
//
// The analyzer in production fills this from distributed-trace spans aggregated
// by "owning file" (the file whose function is the top frame). UI renderers
// map p95 → color and optionally tint the file card's background toward the
// latency colour so hot paths jump out at any zoom level.

export interface FileLatency {
  fileId: string;
  /** Milliseconds. */
  p50: number;
  p95: number;
  p99: number;
  /** Observed call count per minute — drives chip thickness in hot-path HUD. */
  callCount: number;
}

// Ramp picked to match the Datadog "APM" heatmap defaults:
//   [0, 20]   → green       (fast path, negligible)
//   (20, 100] → green-amber (slow but healthy)
//   (100,250] → amber       (attention)
//   (250,500) → orange      (hot)
//   >=500ms   → red         (alarm)
//
// Note the asymmetry at 500: the spec says "≥500ms = red", so 500
// inclusive belongs to red. We express this with a strict `<` for
// each bucket except the top, which is a catch-all.
interface Bucket {
  /** Upper bound (exclusive) for this bucket. */
  readonly maxExclusive: number;
  readonly color: number;
}
const RAMP: readonly Bucket[] = [
  { maxExclusive: 21,    color: 0x22c55e }, // green-500   — [0,20]
  { maxExclusive: 101,   color: 0x84cc16 }, // lime-500    — (20,100]
  { maxExclusive: 251,   color: 0xf59e0b }, // amber-500   — (100,250]
  { maxExclusive: 500,   color: 0xf97316 }, // orange-500  — (250,500)
  { maxExclusive: Infinity, color: 0xef4444 }, // red-500 — ≥500
];

/**
 * Resolve a display color for a p95 latency reading.
 * - Negative / NaN → clamped to the 0-bucket (green).
 * - ≥500ms         → red.
 */
export function latencyColor(p95ms: number): number {
  const v = Number.isFinite(p95ms) && p95ms > 0 ? p95ms : 0;
  for (let i = 0; i < RAMP.length; i++) {
    if (v < RAMP[i].maxExclusive) return RAMP[i].color;
  }
  // Unreachable — Infinity bucket terminates the scan above.
  return RAMP[RAMP.length - 1].color;
}
