const MAX_ELEVATION = 80;

export function elevationFromRisk(riskScore: number): number {
  const r = riskScore < 0 ? 0 : riskScore > 100 ? 100 : riskScore;
  return Math.sqrt(r / 100) * MAX_ELEVATION;
}
