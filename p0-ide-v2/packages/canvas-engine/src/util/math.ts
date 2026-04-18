export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function mixHex(colorA: number, colorB: number, t: number): number {
  const k = clamp(t, 0, 1);
  const ar = (colorA >> 16) & 0xff;
  const ag = (colorA >> 8) & 0xff;
  const ab = colorA & 0xff;
  const br = (colorB >> 16) & 0xff;
  const bg = (colorB >> 8) & 0xff;
  const bb = colorB & 0xff;
  const r = Math.round(ar + (br - ar) * k) & 0xff;
  const g = Math.round(ag + (bg - ag) * k) & 0xff;
  const b = Math.round(ab + (bb - ab) * k) & 0xff;
  return (r << 16) | (g << 8) | b;
}

export function hexToCss(n: number): string {
  const clamped = clamp(n, 0, 0xffffff) | 0;
  return `#${clamped.toString(16).padStart(6, "0")}`;
}

export function cssToHex(s: string): number {
  const raw = s.trim().replace(/^#/, "");
  const expanded =
    raw.length === 3
      ? raw
          .split("")
          .map(ch => ch + ch)
          .join("")
      : raw;
  if (expanded.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(expanded)) {
    return 0;
  }
  return parseInt(expanded, 16) | 0;
}
