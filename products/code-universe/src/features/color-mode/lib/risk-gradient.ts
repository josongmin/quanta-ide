// Risk → colour gradient
// --------------------------------------------------------------------
// Maps a `riskScore` in [0, 100] to an interpolated hex colour along a
// four-stop perceptual ramp:
//
//   0   — emerald (safe / cold)
//   33  — amber   (watch)
//   66  — orange  (hot)
//   100 — crimson (critical)
//
// The ramp is tuned for a light background so "safe" is not too
// bright and "critical" is saturated enough to stand out when mixed
// with the rest of the canvas chrome.

interface RGB { r: number; g: number; b: number }

const STOPS: readonly { at: number; c: RGB }[] = [
  { at: 0,   c: { r: 0xa7, g: 0xf3, b: 0xd0 } }, // emerald-200
  { at: 33,  c: { r: 0xfd, g: 0xe6, b: 0x8a } }, // amber-300
  { at: 66,  c: { r: 0xfd, g: 0xba, b: 0x74 } }, // orange-300
  { at: 100, c: { r: 0xef, g: 0x44, b: 0x44 } }, // red-500
];

/** Return the risk colour as a Pixi-style 0xRRGGBB integer. */
export function riskColor(score: number): number {
  const r = interp(score);
  return (r.r << 16) | (r.g << 8) | r.b;
}

/** Same ramp as a CSS hex string, for SVG / CSS consumers. */
export function riskColorCss(score: number): string {
  const r = interp(score);
  return `#${toHex(r.r)}${toHex(r.g)}${toHex(r.b)}`;
}

function interp(score: number): RGB {
  const s = Math.max(0, Math.min(100, score));
  for (let i = 0; i < STOPS.length - 1; i++) {
    const a = STOPS[i]!;
    const b = STOPS[i + 1]!;
    if (s >= a.at && s <= b.at) {
      const t = (s - a.at) / Math.max(1, b.at - a.at);
      return {
        r: Math.round(a.c.r + (b.c.r - a.c.r) * t),
        g: Math.round(a.c.g + (b.c.g - a.c.g) * t),
        b: Math.round(a.c.b + (b.c.b - a.c.b) * t),
      };
    }
  }
  return STOPS[STOPS.length - 1]!.c;
}

function toHex(n: number): string {
  return n.toString(16).padStart(2, "0");
}

/**
 * Palette per ArchLayer — domain / adapter / infra / ui / util. Used
 * by the "layer" colour mode so architectural zones are immediately
 * recognisable before the user even reads a label.
 */
export const LAYER_COLOR: Record<string, number> = {
  domain: 0xddd6fe,  // violet-200
  adapter: 0xbae6fd, // sky-200
  infra: 0xfde68a,   // amber-200
  ui: 0xfbcfe8,      // pink-200
  util: 0xe5e7eb,    // gray-200
  unknown: 0xf3f4f6, // gray-100
};

export const LAYER_COLOR_CSS: Record<string, string> = {
  domain: "#ddd6fe",
  adapter: "#bae6fd",
  infra: "#fde68a",
  ui: "#fbcfe8",
  util: "#e5e7eb",
  unknown: "#f3f4f6",
};
