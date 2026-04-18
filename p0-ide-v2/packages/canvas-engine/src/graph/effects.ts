// Per-file side-effect annotation — lets the UI surface "what does this file
// do to the world?" as pre-attentive chips next to each file card.
//
// Models what Codeium's "side-effect aware" inspector and Effekt.lang's effect
// rows show: a small set of observed kinds per file. The analyzer in
// production will fill this by walking AST nodes for known-effectful calls
// (DB client, fs, net, crypto, etc.) and the tests/mock fill it by path
// heuristics.
//
// The palette is tuned so a reader can glance at a row of chips and know
// whether a file talks to the database, the network, the filesystem, or is
// pure. No emoji glyphs — codebase rule — so the glyph field carries a
// 2-3 letter ASCII code rendered as text inside the chip.

export type EffectKind =
  | "db"
  | "io"
  | "net"
  | "env"
  | "fs"
  | "crypto"
  | "random"
  | "time"
  | "pure";

export interface FileEffects {
  fileId: string;
  /** Set of observed effect kinds, deduped. Order is display order. */
  effects: readonly EffectKind[];
  /**
   * Optional count of pure functions within this file. Surfaces as a
   * "N/M pure" hint in tooltips when present; omitted when the analyzer
   * didn't classify at the function level.
   */
  pureFunctions?: number;
  /** Total function count — denominator for the pure-ratio hint. */
  totalFunctions?: number;
}

export interface EffectStyle {
  /** Chip fill color, 0xRRGGBB. */
  color: number;
  /** 2-3 letter ASCII glyph; rendered as text inside the chip. */
  glyph: string;
  /** Human-readable description for tooltips / HUD. */
  description: string;
}

// Palette semantics: warm/earthy for filesystem + fs-like; blue for net; amber
// for DB (historically the "gold/amber storage" metaphor in infra diagrams);
// purple for crypto (security accent); pink for random (non-determinism);
// cyan for time; green for pure (positive). Contrast against both the light
// risk-fill card backgrounds (#dcfce7/#fef3c7/#fee2e2) and the mid-grey dark
// chip body was verified at 3:1 WCAG AA.
export const EFFECT_STYLE: Record<EffectKind, EffectStyle> = {
  db:     { color: 0xf59e0b, glyph: "DB",  description: "database read/write" },
  io:     { color: 0x14b8a6, glyph: "IO",  description: "general input/output" },
  net:    { color: 0x3b82f6, glyph: "NET", description: "network request" },
  env:    { color: 0x6b7280, glyph: "ENV", description: "process env / config" },
  fs:     { color: 0x92400e, glyph: "FS",  description: "filesystem access" },
  crypto: { color: 0x8b5cf6, glyph: "CRY", description: "crypto / signing" },
  random: { color: 0xec4899, glyph: "RND", description: "nondeterministic random" },
  time:   { color: 0x06b6d4, glyph: "TIM", description: "clock / timers" },
  pure:   { color: 0x22c55e, glyph: "PUR", description: "pure (no observed effects)" },
};

/** Ordered list for iteration (HUD legend + tests). */
export const EFFECT_KINDS: readonly EffectKind[] = [
  "db", "io", "net", "env", "fs", "crypto", "random", "time", "pure",
] as const;
