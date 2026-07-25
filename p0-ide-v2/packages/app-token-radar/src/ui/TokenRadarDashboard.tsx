import "./token-radar-dashboard.css";
import { useMemo, useState } from "react";

/**
 * TokenRadarDashboard — repo-level control plane.
 *
 * Cross-run aggregate of recent agent runs. Standalone tab (full width,
 * no inspector/canvas chrome). Per-file deep view lives in the IDE
 * inspector "TokenRadar" mode.
 */

type RunStatus = "running" | "merged" | "failed" | "stuck" | "paused";
type Severity = "critical" | "warn" | "advice" | "info";

interface ActiveRun {
  runId: string;
  fileName: string;
  status: RunStatus;
  costUsd: number;
  totalTokens: number;
  cacheHit: number;
  retries: number;
  zScore: number;
  topIssue: string | null;
  topIssueSev: Severity;
}

interface HotspotRow {
  fileName: string;
  tokens: number;
  reads: number;
  modifies: number;
  reverts: number;
  share: number;
}

interface RecRow {
  id: string;
  severity: Severity;
  origin: string;
  title: string;
  impact: string;
  runFile: string;
}

const RUNS: readonly ActiveRun[] = [
  {
    runId: "run-2026-04-28-orch-r418",
    fileName: "orchestrator.py",
    status: "paused",
    costUsd: 126.9,
    totalTokens: 42_300_000,
    cacheHit: 0.12,
    retries: 7,
    zScore: 4.2,
    topIssue: "secret leaked + budget guard tripped",
    topIssueSev: "critical",
  },
  {
    runId: "run-2026-04-28-sec-r418",
    fileName: "security.py",
    status: "running",
    costUsd: 42.1,
    totalTokens: 13_840_000,
    cacheHit: 0.35,
    retries: 3,
    zScore: 1.1,
    topIssue: "scope spreading auth/ → audit/, payment/",
    topIssueSev: "warn",
  },
  {
    runId: "run-2026-04-28-rout-r418",
    fileName: "routing_policy.py",
    status: "merged",
    costUsd: 24.3,
    totalTokens: 8_140_000,
    cacheHit: 0.71,
    retries: 1,
    zScore: 0.4,
    topIssue: null,
    topIssueSev: "info",
  },
];

const HOTSPOTS: readonly HotspotRow[] = [
  { fileName: "src/auth/service.ts",        tokens: 18_240_000, reads: 22, modifies:  4, reverts: 1, share: 0.28 },
  { fileName: "orchestrator.py",            tokens: 11_700_000, reads: 18, modifies:  9, reverts: 3, share: 0.18 },
  { fileName: "security.py",                tokens:  6_280_000, reads: 12, modifies:  6, reverts: 1, share: 0.10 },
  { fileName: "routing_policy.py",          tokens:  4_120_000, reads:  6, modifies:  4, reverts: 0, share: 0.06 },
  { fileName: "src/app/router.ts",          tokens:  4_180_000, reads:  8, modifies:  2, reverts: 0, share: 0.06 },
  { fileName: "prisma/schema.prisma",       tokens:  3_290_000, reads:  6, modifies:  1, reverts: 0, share: 0.05 },
  { fileName: "src/audit/writer.ts",        tokens:  2_140_000, reads:  6, modifies:  2, reverts: 0, share: 0.03 },
  { fileName: "src/auth/middleware.ts",     tokens:  1_240_000, reads:  9, modifies:  7, reverts: 6, share: 0.02 },
];

const RECS: readonly RecRow[] = [
  { id: "r1", severity: "critical", origin: "secret",   title: "AWS key leaked at 02:00 — rotate now",          impact: "compliance / blast",     runFile: "orchestrator.py" },
  { id: "r2", severity: "critical", origin: "policy",   title: "Budget tripped $126.9 / max $80",               impact: "stop further burn",       runFile: "orchestrator.py" },
  { id: "r3", severity: "warn",     origin: "cache",    title: "Cache hit 12% — $182/day on the table",         impact: "−$182/day",              runFile: "orchestrator.py" },
  { id: "r4", severity: "warn",     origin: "pingpong", title: "Pingpong on auth/middleware.ts L42-L58",         impact: "human required",         runFile: "orchestrator.py" },
  { id: "r5", severity: "warn",     origin: "stuck",    title: "Stuckness 87% — pause + summarize",              impact: "stop oscillation",       runFile: "orchestrator.py" },
  { id: "r6", severity: "warn",     origin: "scope",    title: "Scope spreading auth/ → audit/, payment/",       impact: "drift index 0.54",        runFile: "security.py" },
  { id: "r7", severity: "advice",   origin: "model",    title: "26 review calls fit Sonnet",                     impact: "−$31",                    runFile: "orchestrator.py" },
  { id: "r8", severity: "advice",   origin: "context",  title: "RFC-217 re-injected 37× — replace with summary", impact: "−$22 / future runs",      runFile: "orchestrator.py" },
];

const TOTAL = {
  costUsd:    RUNS.reduce((a, r) => a + r.costUsd, 0),
  tokens:     RUNS.reduce((a, r) => a + r.totalTokens, 0),
  avgCacheHit:RUNS.reduce((a, r) => a + r.cacheHit, 0) / RUNS.length,
  openRecs:   RECS.filter((r) => r.severity === "critical" || r.severity === "warn").length,
};

const STATUS_LABEL: Record<RunStatus, string> = {
  running: "running",
  merged:  "merged",
  failed:  "failed",
  stuck:   "stuck",
  paused:  "paused",
};

function statusToneCls(s: RunStatus): string {
  switch (s) {
    case "merged":  return "trd-pill--ok";
    case "running": return "trd-pill--info";
    case "paused":  return "trd-pill--warn";
    case "stuck":   return "trd-pill--warn";
    case "failed":  return "trd-pill--bad";
  }
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}
function fmtUsd(n: number, opts?: { showCents?: boolean }): string {
  const showCents = opts?.showCents ?? n < 100;
  if (showCents) return `$${n.toFixed(n < 1 ? 2 : 1)}`;
  return `$${Math.round(n).toLocaleString()}`;
}
function fmtPct(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

type SevFilter = "all" | Severity;

const SEV_FILTERS: ReadonlyArray<{ id: SevFilter; label: string }> = [
  { id: "all",      label: "all" },
  { id: "critical", label: "critical" },
  { id: "warn",     label: "warn" },
  { id: "advice",   label: "advice" },
];

export function TokenRadarDashboard() {
  const [sevFilter, setSevFilter] = useState<SevFilter>("all");

  const filteredRecs = useMemo(
    () => (sevFilter === "all" ? RECS : RECS.filter((r) => r.severity === sevFilter)),
    [sevFilter],
  );

  const topShare = HOTSPOTS[0]?.share ?? 1;

  return (
    <div className="trd">
      <header className="trd__hero">
        <div className="trd__hero-id">
          <span className="trd__brand">TokenRadar</span>
          <span className="trd__hero-sep">·</span>
          <span className="trd__hero-sub">agent runtime control plane</span>
        </div>
        <div className="trd__hero-meta">
          {RUNS.length} active run{RUNS.length === 1 ? "" : "s"} · last 24h<br />
          <span className="trd__hero-meta-sub">per-file 상세는 IDE inspector "TokenRadar" 탭</span>
        </div>
      </header>

      <section className="trd__kpis">
        <Kpi label="total cost"       value={fmtUsd(TOTAL.costUsd)}       sub={`${RUNS.length} runs · 24h`}              tone="bad" />
        <Kpi label="total tokens"     value={fmtTokens(TOTAL.tokens)}     sub="input + output across runs" />
        <Kpi label="avg cache hit"    value={fmtPct(TOTAL.avgCacheHit)}   sub="weighted across runs"                     tone={TOTAL.avgCacheHit < 0.4 ? "bad" : "ok"} />
        <Kpi label="open advisories"  value={`${TOTAL.openRecs}`}         sub="critical + warn"                          tone={TOTAL.openRecs > 4 ? "bad" : "warn"} />
      </section>

      <section className="trd__section">
        <div className="trd__section-h">
          <span>active runs</span>
          <span className="trd__section-count">{RUNS.length}</span>
        </div>
        <div className="trd__runs">
          {RUNS.map((r) => (
            <article key={r.runId} className="trd__run">
              <div className="trd__run-h">
                <div className="trd__run-id">
                  <div className="trd__run-file">{r.fileName}</div>
                  <div className="trd__run-runid">{r.runId}</div>
                </div>
                <span className={`trd__pill ${statusToneCls(r.status)}`}>
                  <span className="trd__pill-dot" />
                  {STATUS_LABEL[r.status]}
                </span>
              </div>

              <div className="trd__run-metrics">
                <RunMetric label="cost"     value={fmtUsd(r.costUsd)}       tone={r.zScore >= 2 ? "bad" : undefined} />
                <RunMetric label="tokens"   value={fmtTokens(r.totalTokens)} />
                <RunMetric label="cache"    value={fmtPct(r.cacheHit)}      tone={r.cacheHit < 0.4 ? "warn" : "ok"} />
                <RunMetric label="retries"  value={`${r.retries}`}          tone={r.retries >= 3 ? "warn" : undefined} />
                <RunMetric label="z-score"  value={`${r.zScore.toFixed(1)}σ`} tone={r.zScore >= 2 ? "bad" : r.zScore >= 1 ? "warn" : undefined} />
              </div>

              {r.topIssue && (
                <div className={`trd__run-issue trd__run-issue--${r.topIssueSev}`}>
                  <span className="trd__chip">{r.topIssueSev}</span>
                  <span>{r.topIssue}</span>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      <div className="trd__two-col">
        <article className="trd__card">
          <div className="trd__card-h">
            <span>cross-run file hotspots</span>
            <span className="trd__section-count">{HOTSPOTS.length}</span>
          </div>
          <ul className="trd__hotspots">
            {HOTSPOTS.map((h) => (
              <li key={h.fileName} className="trd__hotspot">
                <div className="trd__hotspot-h">
                  <code className="trd__mono">{h.fileName}</code>
                  <span className="trd__hotspot-tokens">{fmtTokens(h.tokens)}</span>
                </div>
                <div className="trd__bar">
                  <span
                    className="trd__bar-fill"
                    style={{ width: `${(h.share / Math.max(topShare, 0.0001)) * 100}%` }}
                  />
                </div>
                <div className="trd__hotspot-meta">
                  <span>{fmtPct(h.share)}</span>
                  <span>· {h.reads} reads</span>
                  <span>· {h.modifies} mods</span>
                  {h.reverts > 0 && <span className="trd__hotspot-rev">· {h.reverts} reverts</span>}
                </div>
              </li>
            ))}
          </ul>
        </article>

        <article className="trd__card">
          <div className="trd__card-h">
            <span>prioritized recommendations</span>
            <span className="trd__section-count">{filteredRecs.length}</span>
          </div>

          <div className="trd__filters" role="toolbar" aria-label="Severity filter">
            {SEV_FILTERS.map((f) => {
              const active = sevFilter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSevFilter(f.id)}
                  className={`trd__filter${active ? " is-active" : ""}`}
                  aria-pressed={active}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          {filteredRecs.length === 0 ? (
            <div className="trd__empty">no recommendations match this filter</div>
          ) : (
            <ul className="trd__recs">
              {filteredRecs.map((r) => (
                <li key={r.id} className={`trd__rec trd__rec--${r.severity}`}>
                  <div className="trd__rec-h">
                    <span className={`trd__chip trd__chip--${r.severity}`}>{r.severity}</span>
                    <span className="trd__chip">{r.origin}</span>
                    <span className="trd__rec-title">{r.title}</span>
                  </div>
                  <div className="trd__rec-meta">
                    <span className="trd__rec-impact">{r.impact}</span>
                    <span className="trd__chip trd__chip--neutral">{r.runFile}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>

      <footer className="trd__footer">
        <span>per-file 상세 보기 → IDE inspector "TokenRadar" 탭</span>
        <span className="trd__footer-sub">control-plane: budget guard · auto-pause · cache breakpoint advisor</span>
      </footer>
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "ok" | "warn" | "bad" }) {
  return (
    <div className="trd__kpi">
      <div className={`trd__kpi-v${tone ? ` trd__kpi-v--${tone}` : ""}`}>{value}</div>
      <div className="trd__kpi-label">{label}</div>
      <div className="trd__kpi-sub">{sub}</div>
    </div>
  );
}

function RunMetric({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" | "bad" }) {
  return (
    <div className="trd__run-metric">
      <div className={`trd__run-metric-v${tone ? ` trd__run-metric-v--${tone}` : ""}`}>{value}</div>
      <div className="trd__run-metric-k">{label}</div>
    </div>
  );
}
