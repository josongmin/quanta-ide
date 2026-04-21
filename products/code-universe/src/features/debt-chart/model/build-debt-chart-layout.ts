import { computeDebtTrajectory } from "@quanta/canvas-engine";
import type { DebtChartLayout, DebtSeries, BuildDebtChartLayoutOpts } from "./types";

// build-debt-chart-layout
// --------------------------------------------------------------------
// Pure algorithm: WorkspaceGraph + viewport dimensions → DebtChartLayout.
// Calls computeDebtTrajectory on graph.history to get commit snapshots,
// then normalises each metric series to 0..1 for uniform charting.
//
// Determinism: no Math.random(), no Date.now(). All iteration is over
// ordered arrays produced by computeDebtTrajectory (oldest→newest).

// ── Layout constants ─────────────────────────────────────────────────
const PAD_LEFT = 55;    // Y axis labels
const PAD_TOP = 24;
const PAD_RIGHT = 140;  // Legend
const PAD_BOTTOM = 40;  // X axis labels

// ── Series definitions (ordered for z-render) ────────────────────────
type SeriesDef = {
  key: DebtSeries["key"];
  label: string;
  color: string;
  isDebtMetric: boolean;
};

const SERIES_DEFS: SeriesDef[] = [
  { key: "sccCount",           label: "Cycles",          color: "#ef4444", isDebtMetric: true  },
  { key: "archViolationCount", label: "Arch Violations",  color: "#f59e0b", isDebtMetric: true  },
  { key: "edgeCount",          label: "Total Edges",      color: "#6366f1", isDebtMetric: false },
  { key: "fileCount",          label: "Files",            color: "#06b6d4", isDebtMetric: false },
  { key: "avgCpx",             label: "Avg Complexity",   color: "#8b5cf6", isDebtMetric: true  },
];

// ── Main entry ───────────────────────────────────────────────────────

export function buildDebtChartLayout(opts: BuildDebtChartLayoutOpts): DebtChartLayout {
  const { graph, width, height } = opts;
  const enabledKeys = opts.enabledKeys ?? SERIES_DEFS.map(d => d.key);
  const enabledSet = new Set<DebtSeries["key"]>(enabledKeys);

  const padLeft   = PAD_LEFT;
  const padTop    = PAD_TOP;
  const padRight  = PAD_RIGHT;
  const padBottom = PAD_BOTTOM;
  const plotWidth  = width  - padLeft - padRight;
  const plotHeight = height - padTop  - padBottom;

  // ── 1. No history → empty layout ────────────────────────────────────
  if (!graph.history || graph.history.snapshots.length === 0) {
    return {
      series: [],
      snapshots: [],
      snapshotCount: 0,
      hasHistory: false,
      plotWidth,
      plotHeight,
      padLeft,
      padTop,
      padRight,
      padBottom,
    };
  }

  // ── 2. Compute trajectory ────────────────────────────────────────────
  const rawSnapshots = computeDebtTrajectory(graph.history, {
    files: graph.files,
    fileEdges: graph.fileEdges,
  });

  // Convert readonly array to mutable for storage in the layout.
  const snapshots = [...rawSnapshots];
  const N = snapshots.length;

  // ── 3. Determine which avgCpx-bearing series to include ─────────────
  // avgCpx is optional on each snapshot — only include the series if at
  // least one snapshot has a defined value.
  const hasAvgCpx = snapshots.some(s => s.avgCpx !== undefined);

  // ── 4. Build series ──────────────────────────────────────────────────
  const series: DebtSeries[] = [];

  for (const def of SERIES_DEFS) {
    if (!enabledSet.has(def.key)) continue;
    if (def.key === "avgCpx" && !hasAvgCpx) continue;

    // Extract raw values for this metric.
    const raws: number[] = snapshots.map(s => {
      if (def.key === "avgCpx") {
        return s.avgCpx ?? 0;
      }
      return s[def.key];
    });

    // Compute max for normalisation.
    let maxVal = 0;
    for (const r of raws) {
      if (r > maxVal) maxVal = r;
    }

    // Build normalised points.
    const points = raws.map((raw, i) => {
      const snap = snapshots[i]!;
      const v = maxVal === 0 ? 0 : raw / maxVal;
      // t: horizontal position 0..1; for N=1 place at t=0.
      const t = N === 1 ? 0 : i / (N - 1);
      return { t, v, raw, sha: snap.sha, timestamp: snap.timestamp };
    });

    const firstRaw = raws[0] ?? 0;
    const lastRaw  = raws[raws.length - 1] ?? 0;

    series.push({
      label:        def.label,
      key:          def.key,
      color:        def.color,
      isDebtMetric: def.isDebtMetric,
      points,
      currentValue: lastRaw,
      delta:        lastRaw - firstRaw,
    });
  }

  return {
    series,
    snapshots,
    snapshotCount: N,
    hasHistory: true,
    plotWidth,
    plotHeight,
    padLeft,
    padTop,
    padRight,
    padBottom,
  };
}
