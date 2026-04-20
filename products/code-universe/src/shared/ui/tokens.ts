// Code Universe design tokens
// --------------------------------------------------------------------
// Mirror of `@quanta/ui-kit/styles/tokens.css` — the host's canonical
// token set. Using the same values here keeps HTML panels and the
// Pixi canvas visually in the same family (same greys, same accent
// blue, same kind hues). Any retune happens in ui-kit first; these
// follow.
//
// Why values-as-JS instead of reading the CSS vars:
//   - Pixi takes hex INT (0xRRGGBB) not CSS strings, so we'd need
//     a parser per frame anyway.
//   - HTML widget inline-styles want literal strings, not var(--).
//   - Centralising here lets both consumers share EXACT values with
//     a single source of truth at the product slice.

import type { EntityKind } from "@quanta/canvas-engine";

export const color = {
  /** App-shell surface behind everything. */
  bg0: "#ffffff",
  /** Panel surface — same as bg0 in light mode, kept as its own slot
   *  so dark mode can diverge without a rename. */
  bg1: "#ffffff",
  /** Subtle fill for section headers, inset rows, empty states. */
  bg2: "#fafafa",
  /** One step darker still — chip / muted container fills. */
  bg3: "#f5f5f5",
  /** Hover background on rows / ghost buttons (p0 --bg-hover). */
  hover: "#f0f0f0",
  /** Selected bg (p0 --bg-selected). */
  selected: "#ebebeb",

  /** Divider hairline (p0 --border). */
  border: "#e4e4e4",
  /** Stronger border — hover state on cards, active control outlines. */
  borderStrong: "#cdcdcd",
  /** Even softer divider for inside-card separations. */
  borderSoft: "rgba(10, 10, 10, 0.06)",

  /** p0 --fg — near-black primary text. */
  text0: "#0a0a0a",
  /** p0 --fg-muted — secondary. */
  text1: "#3d3d3d",
  /** p0 --fg-subtle — labels, captions. */
  text2: "#757575",
  /** p0 --fg-dead — placeholder / disabled. */
  text3: "#a0a0a5",

  /** p0 --accent — Figma blue. Used for selection, primary action,
   *  inline links. Keep usage rare — everything else should be
   *  neutral so the accent stays meaningful. */
  accent: "#0d99ff",
  accentHover: "#0a7acc",
  /** 10% mix of accent over white — selection chip fills, focus tint. */
  accentSoft: "rgba(13, 153, 255, 0.10)",
  /** 6% — even softer, full-card focus tint. */
  accentSofter: "rgba(13, 153, 255, 0.06)",
  /** 24% — accent border on chips and focus rings. */
  accentBorder: "rgba(13, 153, 255, 0.28)",

  /** Semantic status (p0 --success/--warn/--danger). */
  success: "#22a06b",
  warn: "#e09321",
  danger: "#e5484d",

  /** Entity-kind accent hues. These are the ONLY kind-coded colors
   *  in the UI — used as 3-px dots and inline labels, never as full
   *  card fills (see feedback/no-left-color-stripe). */
  kindUniverse: "#7e4ed6",
  kindGalaxy: "#0d99ff",
  kindStreet: "#22a06b",
  kindBuilding: "#3d3d3d",
  kindFloor: "#e09321",
  kindRoom: "#e5484d",
} as const;

export const space = {
  0: 2,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 32,
} as const;

export const radius = {
  xs: 2,
  sm: 4,
  md: 6,
  lg: 8,
  pill: 999,
} as const;

export const font = {
  sans:
    "'Inter Tight', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Pretendard, sans-serif",
  /** Alias — `family` kept for older call sites. Prefer `sans`. */
  family:
    "'Inter Tight', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Pretendard, sans-serif",
  mono: "ui-monospace, SFMono-Regular, Menlo, 'JetBrains Mono', monospace",
  size: { xxs: 9, xs: 10, sm: 11, md: 12, lg: 13, xl: 14, xxl: 16, display: 18 },
  weight: { regular: 400, medium: 500, semibold: 600, bold: 700 },
  letter: { tight: -0.01, normal: 0, wide: 0.02, ultra: 0.06 },
} as const;

export const shadow = {
  xs: "0 1px 2px rgba(0, 0, 0, 0.03)",
  sm: "0 1px 2px rgba(0, 0, 0, 0.04)",
  md: "0 4px 12px rgba(0, 0, 0, 0.08)",
  lg: "0 12px 32px rgba(0, 0, 0, 0.10)",
} as const;

export const transition = {
  fast: "120ms cubic-bezier(0.2, 0, 0.1, 1)",
  base: "180ms cubic-bezier(0.2, 0, 0.1, 1)",
} as const;

export const kindColor: Readonly<Record<EntityKind, string>> = {
  universe: color.kindUniverse,
  galaxy: color.kindGalaxy,
  street: color.kindStreet,
  building: color.kindBuilding,
  floor: color.kindFloor,
  room: color.kindRoom,
};

export const kindLabel: Readonly<Record<EntityKind, string>> = {
  universe: "Universe",
  galaxy: "Galaxy",
  street: "Street",
  building: "File",
  floor: "Module",
  room: "Function",
};

// Pixi needs hex ints (0xRRGGBB). Mirror the same values as integer
// literals so the GPU renderer and the HTML panels share one source.
export const pixiColor = {
  bg: 0xffffff,
  bgSubtle: 0xfafafa,
  bgMuted: 0xf5f5f5,
  border: 0xe4e4e4,
  borderStrong: 0xcdcdcd,

  text: 0x0a0a0a,
  textMuted: 0x3d3d3d,
  textSubtle: 0x757575,

  accent: 0x0d99ff,
  /** Selected card fill — 4% accent over white, pre-mixed so we don't
   *  need alpha-blending per draw. */
  selectedFill: 0xf0f8ff,

  /** Edge stroke — neutral gray so edges don't steal attention from
   *  selected cards. */
  edge: 0xa0a0a5,
  edgeHighlight: 0x0d99ff,
  /** Dependency-direction colouring under spotlight. Outbound uses the
   *  accent blue (where the selection reaches TO), inbound uses the
   *  success green (what reaches INTO the selection). Same hues are
   *  mirrored on the HTML Inspector so the mental model is one-to-one
   *  between canvas and panel. */
  edgeOut: 0x0d99ff,
  edgeIn: 0x22a06b,

  /** Dot-grid background. */
  grid: 0x0a0a0a,

  success: 0x22a06b,
  warn: 0xe09321,
  danger: 0xe5484d,
} as const;

export const pixiKindColor: Readonly<Record<EntityKind, number>> = {
  universe: 0x7e4ed6,
  galaxy: 0x0d99ff,
  street: 0x22a06b,
  building: 0x3d3d3d,
  floor: 0xe09321,
  room: 0xe5484d,
};
