// Chip-bar public surface.
//
// Class-name contract emitted by builders (kept in sync with sibling
// workers W2/W3 — do not rename without coordinating):
//   - chip-internal:   `cm-chip`, `cm-chip__ico`, `cm-chip__sub`,
//                      `cm-chip--taint-{source|sink|passthrough|sanitized}`
//   - chip siblings:   `cm-chip-bar__meta`, `cm-chip-bar__risk`
//   - shared modifiers: `is-bad`, `is-warn`, `is-muted`
//
// Every builder sets an `aria-label` on its outer span; the chip itself
// stays presentational (no role) — the chip-bar container (W3) owns
// `role="group"`.
export {
  createChip,
  createMeta,
  createRisk,
  signature,
  taintChipKind,
  tone,
} from "./model/render";
export { CM_LINE_PAD_PX } from "./model/metrics";
export type { ChipKind, ChipSpec, ChipTone } from "./model/render";
