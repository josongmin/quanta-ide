// Risk score → severity bucket. Single source for the
// "low / mid / high" classification used across the IDE
// (chip bars, badges, popovers, blast lists, …).
//
// Thresholds are inclusive lower bounds:
//   score >= RISK_HIGH      → "high"
//   score >= RISK_MID       → "mid"
//   else                    → "low"
//
// RISK_NOTABLE is a separate cutoff used by `isNotable`-style
// filters (e.g. fn-header decides whether to render at all).
// It is intentionally lower than RISK_HIGH so a function with
// score 50 surfaces a chip bar even though its tone is "mid".

export const RISK_HIGH = 70;
export const RISK_MID = 40;
export const RISK_NOTABLE = 50;

export type RiskTone = "low" | "mid" | "high";

export function tone(riskScore: number): RiskTone {
  if (riskScore >= RISK_HIGH) return "high";
  if (riskScore >= RISK_MID) return "mid";
  return "low";
}
