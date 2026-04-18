// Shared equal-guard wrappers and pool helpers distilled from the
// CityNodeRenderer optimization pass (see CityNodeRenderer.ts for the full
// rationale). Centralising them keeps every tier / overlay renderer applying
// the same micro-optimizations without copy-paste drift.
//
// Why guard at all? Pixi's BitmapText / Text style setters (fontSize, fill)
// and the `.text` setter trigger atlas re-lookup or glyph-layout rebuild on
// *every* assignment — even when the new value is identical to the old one.
// Walking thousands of labels per frame this turns into one of the biggest
// allocators in a dev-build. The cheapest fix is to compare before writing;
// TypeScript's narrowing keeps both branches inlinable.
//
// Numeric `fill` only. `TextStyle.fill` also accepts colour objects / arrays
// (gradients). We only ever write plain numbers in this repo, so number
// equality is sufficient — a caller passing a gradient would not re-use the
// same object across frames anyway.

import type { BitmapText, Text } from "pixi.js";

// Duck-typed shape covers both BitmapText and Text without importing the
// full Pixi type (and without coupling to a specific Text flavour). Both
// expose a `.style` object with mutable `fontSize` / `fill`.
type StyledText = BitmapText | Text;

// Skip the fontSize assignment when the current value already matches. The
// BitmapText setter invalidates the font atlas cache on any write; the Text
// setter schedules a full layout reflow. Either is wasted work when the
// value is stable.
export function setFontSize(bt: StyledText, size: number): void {
  if (bt.style.fontSize !== size) bt.style.fontSize = size;
}

// Skip the fill assignment when the current value already matches. See
// module header for why numeric-only is fine here.
export function setFill(bt: StyledText, color: number): void {
  if (bt.style.fill !== color) bt.style.fill = color;
}

// Skip the text assignment when the string hasn't changed. BitmapText.text
// rebuilds glyph geometry on every set; Text.text triggers a canvas re-draw.
export function setText(bt: StyledText, text: string): void {
  if (bt.text !== text) bt.text = text;
}

// Fold a hash step into a running i32. `Math.imul` keeps the product
// numeric (no silent BigInt / float promotion); `| 0` after both operations
// coerces the result back to signed 32-bit. A collision here only loses one
// frame of dirty-flag invalidation — cosmetic cost, not correctness.
export function hashStep(acc: number, value: number): number {
  return (Math.imul(acc | 0, 31) + (value | 0)) | 0;
}

// Fold a string into a running i32. Used for hashing ids (file ids, agent
// ids, etc.) into the dirty-flag key. ASCII-safe is enough: charCodeAt is
// fine to collide on emoji / surrogate halves because the caller only uses
// the hash to detect *changes*, not to identify the item.
export function hashStringStep(acc: number, s: string): number {
  let h = acc | 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  }
  return h;
}

// Pool of small mutable record slots. Pre-grows to `n` entries so the hot
// loop can overwrite fields on existing objects instead of pushing fresh
// `{...}` literals per frame. Capacity never shrinks under the frame
// protocol — renderers are held for the lifetime of the LOD tier, and peak
// visible set is a decent estimate of steady-state working size.
//
// Frame protocol (two — and only two — supported reset paths):
//
//   1. `reset()` — drops *both* logical length and capacity to zero. Use
//      when the renderer is draining (clear(), destroy(), or empty-input
//      early-return). DO NOT hand-write `pool.slots.length = 0` instead:
//      that leaves `capacity` stale, so the next `grow(n)` returns without
//      re-exposing the allocated entries and indexed writes silently land
//      on stale slots.
//
//   2. `grow(n)` + overwrite `.slots[0..n-1]` + `.slots.length = used` —
//      the hot-path pattern. grow() re-exposes all allocated slots so
//      indexed writes are safe; the caller then truncates the logical
//      length passed downstream (e.g. to SpatialPickIndex.load). Next
//      frame's grow() re-extends `.slots.length` to capacity again.
export interface GrowingPool<T> {
  slots: T[];
  capacity: number;
  grow(n: number): void;
  reset(): void;
}

export function makeGrowingPool<T>(factory: () => T): GrowingPool<T> {
  const pool: GrowingPool<T> = {
    slots: [],
    capacity: 0,
    grow(n: number): void {
      while (pool.capacity < n) {
        pool.slots.push(factory());
        pool.capacity++;
      }
      // Re-expose all allocated slots so indexed writes land on live
      // entries. The caller still truncates `.slots.length` to the logical
      // used count at end of frame.
      if (pool.slots.length < pool.capacity) {
        pool.slots.length = pool.capacity;
      }
    },
    reset(): void {
      pool.slots.length = 0;
      pool.capacity = 0;
    },
  };
  return pool;
}
