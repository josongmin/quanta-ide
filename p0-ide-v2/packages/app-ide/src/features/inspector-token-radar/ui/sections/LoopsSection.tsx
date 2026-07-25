import type { AgentRun } from "@quanta/app-ide/entities/token-radar";
import { fmtUsd, fmtPct, ROLE_LABEL, SectionTitle, Sparkline } from "./helpers";

/**
 * TIER 2 — Loops & convergence:
 *   • retry loops list
 *   • stuckness gauge with reasons
 *   • cross-agent pingpong cycles (narrative)
 *   • convergence sparklines (failures + churn + rejections)
 */
export function LoopsSection({ run }: { run: AgentRun }) {
  return (
    <div className="tr-pane__section">
      <SectionTitle
        tier="t2"
        title="Loops & convergence"
        hint="retry / stuck / pingpong + churn over time"
      />

      <div className="tr-pane__loops-grid">
        <RetryCard run={run} />
        <StucknessCard run={run} />
        <PingpongCard run={run} />
        <ConvergenceCard run={run} />
      </div>
    </div>
  );
}

function RetryCard({ run }: { run: AgentRun }) {
  if (run.retryLoops.length === 0) {
    return (
      <article className="tr-pane__card">
        <div className="tr-pane__card-h">retry loop radar</div>
        <div className="tr-pane__empty-row">no retry loops detected</div>
      </article>
    );
  }
  return (
    <article className="tr-pane__card">
      <div className="tr-pane__card-h">
        retry loop radar <span className="tr-pane__card-badge">{run.retryLoops.length}</span>
      </div>
      <ul className="tr-pane__loops-list">
        {run.retryLoops.map((l) => (
          <li key={l.taskId} className="tr-pane__loops-row">
            <div className="tr-pane__loops-row-h">
              <code className="tr-pane__mono">{l.taskId}</code>
              <span className="tr-pane__chip tr-pane__chip--warn">{l.repeats}× repeat</span>
              <span className="tr-pane__loops-waste">−{fmtUsd(l.wastedUsd)}</span>
            </div>
            <ol className="tr-pane__loops-pattern">
              {l.pattern.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
            <div className="tr-pane__loops-intervention">
              <span className="tr-pane__chip">intervention</span>
              {l.intervention}
            </div>
          </li>
        ))}
      </ul>
    </article>
  );
}

function StucknessCard({ run }: { run: AgentRun }) {
  const p = run.stuckness.probability;
  const tone = p >= 0.7 ? "bad" : p >= 0.4 ? "warn" : "ok";
  const W = 132;
  const H = 72;
  const r = 54;
  const cx = W / 2;
  const cy = H - 6;
  const halfCirc = Math.PI * r;
  const dash = p * halfCirc;
  return (
    <article className="tr-pane__card">
      <div className="tr-pane__card-h">stuckness probability</div>
      <div className="tr-pane__stuck-gauge">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`stuckness ${fmtPct(p)}`}>
          <path className="tr-pane__semi-track" d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} />
          <path
            className={`tr-pane__semi-arc tr-pane__semi-arc--${tone}`}
            d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
            strokeDasharray={`${dash.toFixed(2)} ${(halfCirc - dash).toFixed(2)}`}
          />
          <text className="tr-pane__semi-text" x={cx} y={cy - 14} textAnchor="middle">
            {Math.round(p * 100)}
          </text>
          <text className="tr-pane__semi-sub" x={cx} y={cy - 2} textAnchor="middle">
            / 100
          </text>
        </svg>
      </div>
      <div className="tr-pane__stuck-action">
        <span className="tr-pane__chip">recommended</span>
        {run.stuckness.recommendedAction}
      </div>
      <ul className="tr-pane__stuck-reasons">
        {run.stuckness.reasons.map((r, i) => (
          <li key={i}>{r}</li>
        ))}
      </ul>
    </article>
  );
}

function PingpongCard({ run }: { run: AgentRun }) {
  if (run.pingpong.length === 0) {
    return (
      <article className="tr-pane__card">
        <div className="tr-pane__card-h">pingpong (cross-agent)</div>
        <div className="tr-pane__empty-row">no pingpong cycles</div>
      </article>
    );
  }
  return (
    <article className="tr-pane__card">
      <div className="tr-pane__card-h">
        pingpong (cross-agent) <span className="tr-pane__card-badge">{run.pingpong.length}</span>
      </div>
      <ul className="tr-pane__pp-list">
        {run.pingpong.map((p) => (
          <li key={p.id} className="tr-pane__pp-row">
            <div className="tr-pane__pp-row-h">
              <code className="tr-pane__mono">{p.subjectFile}</code>
              <span className="tr-pane__pp-span">{p.subjectLineSpan}</span>
              <span className="tr-pane__chip tr-pane__chip--warn">{p.cycles} cycles</span>
              <span className={`tr-pane__chip${p.resolution === "human-required" ? " tr-pane__chip--bad" : ""}`}>
                {p.resolution}
              </span>
            </div>
            <ol className="tr-pane__pp-narr">
              {p.narrative.map((n, i) => (
                <li key={i}>
                  <span className="tr-pane__mono">{n.at}</span>
                  <span className={`tr-pane__chip tr-pane__chip--role`}>{ROLE_LABEL[n.actor]}</span>
                  <span className={`tr-pane__pp-action tr-pane__pp-action--${n.action}`}>{n.action}</span>
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ul>
    </article>
  );
}

function ConvergenceCard({ run }: { run: AgentRun }) {
  const c = run.convergence;
  const lastFailures = c.failures[c.failures.length - 1] ?? 0;
  const lastChurn = c.churn[c.churn.length - 1] ?? 0;
  const lastRejections = c.rejections[c.rejections.length - 1] ?? 0;
  const isOscillating = c.failures.some((v, i) => i > 0 && v >= (c.failures[i - 1] ?? 0)) && lastFailures > 0;
  const tone = isOscillating ? "tr-pane__spark--bad" : "tr-pane__spark--ok";
  return (
    <article className="tr-pane__card">
      <div className="tr-pane__card-h">convergence curve</div>
      <div className="tr-pane__conv-row">
        <span className="tr-pane__conv-label">failures</span>
        <Sparkline values={c.failures} width={200} height={32} toneCls={tone} filled />
        <span className="tr-pane__conv-now">now {lastFailures}</span>
      </div>
      <div className="tr-pane__conv-row">
        <span className="tr-pane__conv-label">churn</span>
        <Sparkline values={c.churn} width={200} height={32} toneCls="tr-pane__spark--info" filled />
        <span className="tr-pane__conv-now">now {lastChurn} LoC</span>
      </div>
      <div className="tr-pane__conv-row">
        <span className="tr-pane__conv-label">rejections</span>
        <Sparkline values={c.rejections} width={200} height={32} toneCls="tr-pane__spark--warn" filled />
        <span className="tr-pane__conv-now">now {lastRejections}</span>
      </div>
      <div className="tr-pane__conv-foot">
        {isOscillating ? "failures not converging — oscillating" : "failures converging"}
      </div>
    </article>
  );
}
