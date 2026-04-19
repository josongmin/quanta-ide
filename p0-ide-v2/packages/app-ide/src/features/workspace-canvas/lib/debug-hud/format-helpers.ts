// ------------
// Tiny formatter helpers for the scene debug HUD: path basename + sticky
// preview text. Pure string-in / string-out — no React, no store.
// ------------

import type { Sticky } from "../../store/stickies-store";

export function basename(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx >= 0 ? path.slice(idx + 1) : path;
}

export function previewText(s: Sticky): string {
  const t = s.text.trim();
  if (t.length === 0) return "(비어 있음)";
  return t.length > 48 ? t.slice(0, 45) + "…" : t;
}
