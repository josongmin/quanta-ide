import type { CSSProperties } from "react";

export function riskColor(r: number): string {
  if (r >= 70) return "var(--danger)";
  if (r >= 40) return "var(--warn)";
  return "var(--success)";
}

/**
 * Return a `color-mix()` background tint derived from `riskColor()`.
 *
 * @param risk  0-100 risk score
 * @param alpha 0-1 opacity multiplied into the mix (default 0.12)
 */
export function riskColorBg(risk: number, alpha: number = 0.12): string {
  return `color-mix(in srgb, ${riskColor(risk)} ${Math.round(alpha * 100)}%, transparent)`;
}

export function riskBarStyle(score: number): CSSProperties {
  const opacity = 0.35 + (score / 100) * 0.65;
  return { width: `${score}%`, opacity };
}
