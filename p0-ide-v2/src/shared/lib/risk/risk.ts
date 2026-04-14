import type { CSSProperties } from "react";

export function riskColor(r: number): string {
  if (r >= 70) return "var(--danger)";
  if (r >= 40) return "var(--warn)";
  return "var(--success)";
}

export function riskBarStyle(score: number): CSSProperties {
  const opacity = 0.35 + (score / 100) * 0.65;
  return { width: `${score}%`, opacity };
}
