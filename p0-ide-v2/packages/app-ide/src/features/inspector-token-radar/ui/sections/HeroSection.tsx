import type { AgentRun } from "@quanta/app-ide/entities/token-radar";
import {
  STATUS_LABEL,
  fmtTokens,
  fmtUsd,
  fmtMs,
  fmtPct,
  statusToneCls,
  Sparkline,
} from "./helpers";

/**
 * Hero header — first thing the user sees.
 *
 * Big-number layout: cost / tokens / status (tier 1 prominence).
 * Adds the live convergence sparkline so a runaway is visible without
 * scrolling.
 */
export function HeroSection({ run, fileName }: { run: AgentRun; fileName: string }) {
  const inputPct = run.totalTokens > 0 ? run.inputTokens / run.totalTokens : 0;
  const outputPct = run.totalTokens > 0 ? run.outputTokens / run.totalTokens : 0;
  const cachedPct = run.totalTokens > 0 ? run.cache.cachedTokens / run.totalTokens : 0;

  const overspend = run.forecast.zScore > 1.5;
  const sparkValues = run.convergence.churn;
  const sparkTone = overspend ? "tr-pane__spark--bad" : "tr-pane__spark--ok";

  return (
    <header className={`tr-pane__hero${overspend ? " is-overspend" : ""}`}>
      <div className="tr-pane__hero-head">
        <div className="tr-pane__hero-id">
          <span className="tr-pane__brand">TokenRadar</span>
          <span className="tr-pane__hero-sep">·</span>
          <span className="tr-pane__hero-run">{run.runId}</span>
          <span className="tr-pane__hero-sep">·</span>
          <span className="tr-pane__hero-file">{fileName}</span>
        </div>
        <span className={`tr-pane__pill ${statusToneCls(run.status)}`}>
          <span className="tr-pane__pill-dot" />
          {STATUS_LABEL[run.status]}
        </span>
      </div>

      <div className="tr-pane__hero-grid">
        <div className="tr-pane__hero-cost">
          <div className="tr-pane__hero-cost-num">{fmtUsd(run.costUsd)}</div>
          <div className="tr-pane__hero-cost-sub">
            {fmtTokens(run.totalTokens)} tokens · {run.taskCount} task{run.taskCount === 1 ? "" : "s"} ·{" "}
            {fmtMs(run.elapsedMs)}
          </div>
          <div className="tr-pane__hero-mix" aria-label="token mix">
            <div className="tr-pane__hero-mix-bar">
              <span className="tr-pane__hero-mix-input"  style={{ width: `${(inputPct  * 100).toFixed(0)}%` }} />
              <span className="tr-pane__hero-mix-output" style={{ width: `${(outputPct * 100).toFixed(0)}%` }} />
              <span className="tr-pane__hero-mix-cached" style={{ width: `${(cachedPct * 100).toFixed(0)}%` }} />
            </div>
            <div className="tr-pane__hero-mix-legend">
              <span><i className="tr-pane__dot tr-pane__dot--input" /> input {fmtPct(inputPct)}</span>
              <span><i className="tr-pane__dot tr-pane__dot--output" /> output {fmtPct(outputPct)}</span>
              <span><i className="tr-pane__dot tr-pane__dot--cached" /> cached {fmtPct(cachedPct)}</span>
            </div>
          </div>
        </div>

        <div className="tr-pane__kpi-row">
          <Kpi label="tool calls" value={run.toolCalls.toString()} />
          <Kpi label="retries" value={run.retries.toString()} tone={run.retries >= 3 ? "warn" : undefined} />
          <Kpi label="cache hit" value={fmtPct(run.cache.hitRatio)} tone={run.cache.hitRatio < 0.4 ? "warn" : "ok"} />
          <Kpi label="z-score" value={`${run.forecast.zScore.toFixed(1)}σ`} tone={run.forecast.zScore >= 2 ? "bad" : run.forecast.zScore >= 1 ? "warn" : "ok"} />
        </div>

        <div className="tr-pane__hero-spark">
          <div className="tr-pane__hero-spark-label">convergence (churn)</div>
          <Sparkline values={sparkValues} width={196} height={48} toneCls={sparkTone} filled />
          <div className="tr-pane__hero-spark-foot">
            ETA {fmtUsd(run.forecast.projectedTotalUsd)} · burn {fmtUsd(run.forecast.burnUsdPerMin)}/min
          </div>
        </div>
      </div>
    </header>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" | "bad" }) {
  return (
    <div className="tr-pane__kpi">
      <div className={`tr-pane__kpi-v${tone ? ` tr-pane__kpi-v--${tone}` : ""}`}>{value}</div>
      <div className="tr-pane__kpi-k">{label}</div>
    </div>
  );
}
