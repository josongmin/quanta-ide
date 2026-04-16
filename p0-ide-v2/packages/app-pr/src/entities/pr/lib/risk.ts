export type RiskBand = "low" | "med" | "high" | "crit";

export function riskBand(r: number): RiskBand {
  if (r >= 0.8) return "crit";
  if (r >= 0.6) return "high";
  if (r >= 0.35) return "med";
  return "low";
}
