import type { AgentRun } from "@quanta/app-ide/entities/token-radar";
import { fmtPct, fmtUsd, fmtTokens, LinearBar, SectionTitle } from "./helpers";

const ADHERENCE_TONE: Record<string, string> = {
  "on-plan":     "tr-pane__chip--ok",
  "drift":       "tr-pane__chip--warn",
  "scope-creep": "tr-pane__chip--bad",
  "runaway":     "tr-pane__chip--bad",
};

/**
 * TIER 3 — Drift signals:
 *   plan adherence · knowledge spread · compaction loss · streaming waste · reproducibility
 *
 * Less prominent (lighter chrome, dashed borders) — these are advanced
 * reads, not first-look.
 */
export function DriftSection({ run }: { run: AgentRun }) {
  return (
    <div className="tr-pane__section tr-pane__section--t3">
      <SectionTitle
        tier="t3"
        title="Drift signals (advanced)"
        hint="plan / scope / compaction / reproducibility"
      />

      <div className="tr-pane__drift-grid">
        <PlanCard run={run} />
        <ScopeCard run={run} />
        <CompactionCard run={run} />
        <StreamingCard run={run} />
        <ReproCard run={run} />
      </div>
    </div>
  );
}

function PlanCard({ run }: { run: AgentRun }) {
  const p = run.planAdherence;
  return (
    <article className="tr-pane__card tr-pane__card--t3">
      <div className="tr-pane__card-h">plan adherence</div>
      <div className="tr-pane__drift-headline">
        <span className="tr-pane__drift-pct">{fmtPct(p.adherence)}</span>
        <span className={`tr-pane__chip ${ADHERENCE_TONE[p.label] ?? ""}`}>{p.label}</span>
      </div>
      <LinearBar
        value={p.adherence}
        toneCls={p.adherence >= 0.8 ? "tr-pane__bar-fill--ok" : p.adherence >= 0.5 ? "tr-pane__bar-fill--warn" : "tr-pane__bar-fill--bad"}
        height={6}
      />
      <div className="tr-pane__drift-meta">
        steps {p.actualSteps}/{p.plannedSteps} · files {p.actualFiles}/{p.plannedFiles}
      </div>
      {p.unplannedFiles.length > 0 && (
        <details className="tr-pane__drift-details">
          <summary>{p.unplannedFiles.length} unplanned file{p.unplannedFiles.length === 1 ? "" : "s"}</summary>
          <ul className="tr-pane__drift-list">
            {p.unplannedFiles.map((f) => (
              <li key={f}>
                <code className="tr-pane__mono">{f}</code>
              </li>
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}

function ScopeCard({ run }: { run: AgentRun }) {
  const s = run.knowledgeSpread;
  return (
    <article className="tr-pane__card tr-pane__card--t3">
      <div className="tr-pane__card-h">knowledge spread</div>
      <div className="tr-pane__drift-headline">
        <span className="tr-pane__drift-pct">{fmtPct(s.spreadIndex)}</span>
        <span className={`tr-pane__chip ${s.spreadIndex >= 0.6 ? "tr-pane__chip--bad" : s.spreadIndex >= 0.3 ? "tr-pane__chip--warn" : "tr-pane__chip--ok"}`}>
          spread idx
        </span>
      </div>
      <div className="tr-pane__drift-meta">
        started in <code>{s.startedDomains.join(", ")}</code>
      </div>
      <ul className="tr-pane__scope-list">
        {s.currentDomains.map((d) => (
          <li key={d.domain} className="tr-pane__scope-row">
            <code className="tr-pane__mono">{d.domain}</code>
            <div className="tr-pane__scope-bar">
              <LinearBar value={d.touchPct} toneCls="tr-pane__bar-fill--info" height={4} />
            </div>
            <span className="tr-pane__scope-meta">
              {fmtPct(d.touchPct)} · +{d.growthPerHour.toFixed(1)}/h
            </span>
          </li>
        ))}
      </ul>
    </article>
  );
}

function CompactionCard({ run }: { run: AgentRun }) {
  const c = run.compaction;
  return (
    <article className="tr-pane__card tr-pane__card--t3">
      <div className="tr-pane__card-h">compaction loss</div>
      {c.events.length === 0 ? (
        <div className="tr-pane__empty-row">no compaction events</div>
      ) : (
        <>
          <div className="tr-pane__drift-headline">
            <span className="tr-pane__drift-pct">{fmtUsd(c.regenCostUsd)}</span>
            <span className="tr-pane__chip">regen cost</span>
          </div>
          <div className="tr-pane__drift-meta">
            {fmtTokens(c.regenTokens)} tokens regenerated after auto-compact
          </div>
          <ul className="tr-pane__drift-list">
            {c.events.map((e, i) => (
              <li key={i} className="tr-pane__compact-event">
                <span className="tr-pane__mono">{e.at}</span>
                <span>dropped {e.droppedKb} KB</span>
                <span className="tr-pane__compact-topics">{e.topics.join(" · ")}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </article>
  );
}

function StreamingCard({ run }: { run: AgentRun }) {
  const s = run.streaming;
  return (
    <article className="tr-pane__card tr-pane__card--t3">
      <div className="tr-pane__card-h">streaming waste</div>
      {s.cancelledCalls === 0 ? (
        <div className="tr-pane__empty-row">no cancellations</div>
      ) : (
        <>
          <div className="tr-pane__drift-headline">
            <span className="tr-pane__drift-pct">{fmtTokens(s.cancelledTokens)}</span>
            <span className="tr-pane__chip tr-pane__chip--warn">cancelled</span>
          </div>
          <div className="tr-pane__drift-meta">
            {s.cancelledCalls} call{s.cancelledCalls === 1 ? "" : "s"} · {(s.wallClockWastedMs / 1000).toFixed(0)}s wall clock
          </div>
          <div className="tr-pane__drift-foot">{s.reason}</div>
        </>
      )}
    </article>
  );
}

function ReproCard({ run }: { run: AgentRun }) {
  const r = run.reproducibility;
  return (
    <article className="tr-pane__card tr-pane__card--t3">
      <div className="tr-pane__card-h">reproducibility drift</div>
      <div className="tr-pane__drift-headline">
        <span className="tr-pane__drift-pct">{r.divergencePct.toFixed(1)}%</span>
        <span className={`tr-pane__chip ${r.divergencePct >= 10 ? "tr-pane__chip--warn" : "tr-pane__chip--ok"}`}>
          divergent
        </span>
      </div>
      <div className="tr-pane__drift-meta">
        {r.divergentCalls} of {r.sampledCalls} sampled calls diverged at temperature 0
      </div>
      <div className="tr-pane__drift-foot">
        <span className="tr-pane__chip">cause</span>
        {r.suspectedCause}
      </div>
    </article>
  );
}
