import type { WorkspaceGraph } from "@quanta/canvas-engine";
import type {
  Metric,
  TeamContributor,
  TeamFlowData,
} from "./types";

// compute-team-flow
// --------------------------------------------------------------------
// L1 Delivery/Flow Health. No DORA source is connected yet — most cards
// are empty-state by design. Contributor data IS available (FileBlame
// is on the graph when the Git adapter runs), so we do populate:
//   - Active authors (7d / 30d)
//   - Top contributors (by files touched)
//   - Weekly commit histogram (from blame timestamps)
// Everything else is a "connect GitHub to enable" card.

const DAY = 86_400_000;
const WEEK = 7 * DAY;

function fmtInt(n: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(n));
}

export interface ComputeTeamFlowOpts {
  graph: WorkspaceGraph;
  now: number;
}

export function computeTeamFlow(opts: ComputeTeamFlowOpts): TeamFlowData {
  const { graph, now } = opts;
  const blame = graph.blame ?? {};
  const hasBlame = Object.keys(blame).length > 0;

  // ── Build author activity map ────────────────────────────────────────
  const authorTouches = new Map<string, { files: Set<string>; lastAt: number }>();
  const commitsByWeek = new Map<number, { commits: number; authors: Set<string> }>();
  let cutoff7d = now - 7 * DAY;
  let cutoff30d = now - 30 * DAY;
  const authors7d = new Set<string>();
  const authors30d = new Set<string>();

  for (const fileId of Object.keys(blame)) {
    const fb = blame[fileId];
    if (!fb) continue;
    for (const e of fb.entries) {
      let a = authorTouches.get(e.author);
      if (!a) { a = { files: new Set(), lastAt: 0 }; authorTouches.set(e.author, a); }
      a.files.add(fileId);
      if (e.committedAt > a.lastAt) a.lastAt = e.committedAt;

      if (e.committedAt >= cutoff7d) authors7d.add(e.author);
      if (e.committedAt >= cutoff30d) authors30d.add(e.author);

      const weekStart = Math.floor(e.committedAt / WEEK) * WEEK;
      let w = commitsByWeek.get(weekStart);
      if (!w) { w = { commits: 0, authors: new Set() }; commitsByWeek.set(weekStart, w); }
      w.commits += 1;
      w.authors.add(e.author);
    }
  }

  const weeklyActivity = [...commitsByWeek.entries()]
    .sort((a, b) => a[0] - b[0])
    .slice(-12)
    .map(([weekStart, v]) => ({ weekStart, commits: v.commits, authors: v.authors.size }));

  const totalFilesTouched = [...authorTouches.values()].reduce((a, c) => a + c.files.size, 0) || 1;
  const topContributors: TeamContributor[] = [...authorTouches.entries()]
    .map(([author, v]) => ({
      author,
      filesTouched: v.files.size,
      percent: (v.files.size / totalFilesTouched) * 100,
      lastActiveAt: v.lastAt,
    }))
    .sort((a, b) => b.filesTouched - a.filesTouched)
    .slice(0, 8);

  // ── DORA metrics (all missing) ───────────────────────────────────────
  const missingDora = (label: string, hint: string): Metric => ({
    label,
    value: "—",
    status: "missing",
    enableHint: hint,
    confidence: "LOW",
    confidenceReason: "No delivery telemetry source connected.",
  });

  const doraMetrics: readonly Metric[] = [
    missingDora("Deploy Frequency",    "Connect GitHub Releases."),
    missingDora("Lead Time",            "Connect PR → deploy pipeline."),
    missingDora("Change Failure Rate",  "Connect incident feed."),
    missingDora("MTTR",                  "Connect incident feed."),
    missingDora("Rework Rate",           "Connect PR analytics."),
  ];

  const prMetrics: readonly Metric[] = [
    missingDora("PR Cycle Time",       "Connect GitHub PRs."),
    missingDora("First Review Latency","Connect GitHub PRs."),
    missingDora("Batch Size",          "Connect GitHub PRs."),
    missingDora("Flow Efficiency",     "Connect issue tracker."),
    missingDora("Reopen Rate",         "Connect issue tracker."),
  ];

  const flowScore: Metric = {
    label: "Flow Health",
    value: "—",
    status: "missing",
    enableHint: "Connect GitHub + incident feed.",
    confidence: "LOW",
    confidenceReason: "Composite requires DORA + PR metrics.",
  };

  const activeAuthors7d: Metric = {
    label: "Active Authors · 7d",
    value: hasBlame ? fmtInt(authors7d.size) : "—",
    raw: authors7d.size,
    status: hasBlame ? "enabled" : "missing",
    enableHint: "Populate git blame.",
    confidence: hasBlame ? "HIGH" : "LOW",
    confidenceReason: hasBlame
      ? "Distinct authors in the last 7 days from blame timestamps."
      : "No blame data on graph.",
  };

  const activeAuthors30d: Metric = {
    label: "Active Authors · 30d",
    value: hasBlame ? fmtInt(authors30d.size) : "—",
    raw: authors30d.size,
    status: hasBlame ? "enabled" : "missing",
    enableHint: "Populate git blame.",
    confidence: hasBlame ? "HIGH" : "LOW",
    confidenceReason: hasBlame
      ? "Distinct authors in the last 30 days from blame timestamps."
      : "No blame data on graph.",
  };

  return {
    doraMetrics,
    prMetrics,
    flowScore,
    activeAuthors7d,
    activeAuthors30d,
    topContributors,
    weeklyActivity,
    hasBlame,
  };
}
