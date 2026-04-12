/** One calendar day in the rolling repo activity window. */
export interface RepoDailyTrend {
  /** Short label, e.g. "3/14" */
  dayShort: string;
  /** PRs merged that day (mock). */
  prMerged: number;
  /** Net lines changed (additions − deletions), mock. */
  netLoc: number;
}

/** Last 30 UTC calendar days ending 2026-04-12 — deterministic mock. */
export const REPO_DAILY_TRENDS_30D: RepoDailyTrend[] = (() => {
  const data: RepoDailyTrend[] = [];
  const end = new Date(Date.UTC(2026, 3, 12, 12, 0, 0));
  for (let i = 29; i >= 0; i--) {
    const d = new Date(end);
    d.setUTCDate(d.getUTCDate() - i);
    const idx = 29 - i;
    const wobble = Math.round(50 + 40 * Math.sin(idx / 4.2) + 20 * Math.cos(idx / 2.8));
    const prMerged = 1 + (idx % 5) + (idx % 3) + (idx > 20 ? 1 : 0);
    const netLoc = wobble - 80 + (idx % 7) * 15;
    data.push({
      dayShort: `${String(d.getUTCMonth() + 1)}/${String(d.getUTCDate())}`,
      prMerged,
      netLoc,
    });
  }
  return data;
})();

export function aggregateRepoTrends(days: readonly RepoDailyTrend[]) {
  const totalPr = days.reduce((s, d) => s + d.prMerged, 0);
  const totalNetLoc = days.reduce((s, d) => s + d.netLoc, 0);
  const avgPr = days.length > 0 ? totalPr / days.length : 0;
  const maxPr = days.reduce((m, d) => Math.max(m, d.prMerged), 0);
  const maxAbsLoc = days.reduce((m, d) => Math.max(m, Math.abs(d.netLoc)), 0);
  return {
    totalPr,
    totalNetLoc,
    avgPr: Math.round(avgPr * 10) / 10,
    maxPr: maxPr || 1,
    maxAbsLoc: maxAbsLoc || 1,
  };
}
