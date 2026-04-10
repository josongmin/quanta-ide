export function riskColor(score: number): string {
  if (score >= 70) return "var(--token-err)";
  if (score >= 40) return "var(--token-str)";
  return "var(--token-ok)";
}

export function churnColor(risk: string): string {
  if (risk === "high") return "var(--token-err)";
  if (risk === "mid")  return "var(--token-str)";
  return "var(--token-ok)";
}
