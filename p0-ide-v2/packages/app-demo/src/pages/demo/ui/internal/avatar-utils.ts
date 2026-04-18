export interface AvatarPalette {
  bg: string;
  fg: string;
}

export const MEMBER_PALETTES: readonly AvatarPalette[] = [
  { bg: "#fef3c7", fg: "#b45309" },
  { bg: "#dbeafe", fg: "#1d4ed8" },
  { bg: "#fce7f3", fg: "#be185d" },
  { bg: "#dcfce7", fg: "#15803d" },
  { bg: "#fee2e2", fg: "#b91c1c" },
  { bg: "#ede9fe", fg: "#6d28d9" },
  { bg: "#ffedd5", fg: "#c2410c" },
];

export function pickPalette(seed: string): AvatarPalette {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return MEMBER_PALETTES[Math.abs(hash) % MEMBER_PALETTES.length]!;
}

export function initials(name: string, max = 2): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((s) => s[0]!)
    .slice(0, max)
    .join("")
    .toUpperCase();
}
