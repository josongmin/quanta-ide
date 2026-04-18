/** Brand accent colors per AI provider. Hex values are intentional — they represent vendor brand identity and are the only sanctioned hexes in the ai/ category. */

export type VendorId = "anthropic" | "openai" | "google" | "local";

export interface VendorAccent {
  bg: string;       // soft background tint (e.g., for badges)
  fg: string;       // brand accent color
}

export const VENDOR_ACCENTS: Record<VendorId, VendorAccent> = {
  anthropic: { bg: "color-mix(in srgb, #d97706 14%, var(--bg))", fg: "#d97706" },
  openai:    { bg: "color-mix(in srgb, #10b981 14%, var(--bg))", fg: "#10b981" },
  google:    { bg: "color-mix(in srgb, #2563eb 14%, var(--bg))", fg: "#2563eb" },
  local:     { bg: "var(--bg-muted)",                              fg: "var(--fg-muted)" },
};

// Convenience for call-sites that want just the accent
export const vendorFg = (v: VendorId): string => VENDOR_ACCENTS[v].fg;
