import type { AgentRun, Recommendation } from "@quanta/app-ide/entities/token-radar";
import { fmtUsd, SectionTitle } from "./helpers";

const SEVERITY_ORDER: Record<Recommendation["severity"], number> = {
  critical: 0,
  warn:     1,
  advice:   2,
  info:     3,
};

const SEVERITY_TONE: Record<Recommendation["severity"], string> = {
  critical: "tr-pane__rec--critical",
  warn:     "tr-pane__rec--warn",
  advice:   "tr-pane__rec--advice",
  info:     "tr-pane__rec--info",
};

/**
 * Policy / control plane:
 *   • budget guard config + breach status
 *   • prioritized recommendations engine
 */
export function PolicySection({ run }: { run: AgentRun }) {
  const sortedRecs = [...run.recommendations].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  );

  const budget = run.budget;

  const guards: { label: string; observed: string; threshold: string; tripped: boolean }[] = [
    { label: "max cost",    observed: fmtUsd(run.costUsd),                 threshold: fmtUsd(budget.maxCostUsd),  tripped: run.costUsd >= budget.maxCostUsd },
    { label: "max retries", observed: run.retries.toString(),              threshold: budget.maxRetries.toString(), tripped: run.retries >= budget.maxRetries },
    { label: "max wall",    observed: `${Math.round(run.elapsedMs / 60000)}m`, threshold: `${budget.maxWallMinutes}m`, tripped: run.elapsedMs / 60000 >= budget.maxWallMinutes },
    { label: "max files",   observed: run.fileHotspots.length.toString(),  threshold: budget.maxFilesRead.toString(), tripped: run.fileHotspots.length >= budget.maxFilesRead },
  ];

  return (
    <div className="tr-pane__section">
      <SectionTitle
        tier="t1"
        title="Policy & recommendations"
        hint="control-plane: budget guard + auto-suggested fixes"
        badge={`${sortedRecs.length}`}
      />

      <div className="tr-pane__policy-grid">
        <article className="tr-pane__card">
          <div className="tr-pane__card-h">
            budget guard
            <span className="tr-pane__card-badge">on breach: {budget.onBreach}</span>
          </div>
          <ul className="tr-pane__guards">
            {guards.map((g) => (
              <li key={g.label} className={`tr-pane__guard-row${g.tripped ? " is-tripped" : ""}`}>
                <span className="tr-pane__guard-label">{g.label}</span>
                <span className={`tr-pane__guard-observed${g.tripped ? " is-tripped" : ""}`}>{g.observed}</span>
                <span className="tr-pane__guard-threshold">/ {g.threshold}</span>
                <span className={`tr-pane__chip ${g.tripped ? "tr-pane__chip--bad" : "tr-pane__chip--ok"}`}>
                  {g.tripped ? "tripped" : "ok"}
                </span>
              </li>
            ))}
          </ul>
        </article>

        <article className="tr-pane__card">
          <div className="tr-pane__card-h">
            prioritized recommendations
            <span className="tr-pane__card-badge">{sortedRecs.length}</span>
          </div>
          {sortedRecs.length === 0 ? (
            <div className="tr-pane__empty-row">no recommendations</div>
          ) : (
            <ul className="tr-pane__recs">
              {sortedRecs.map((r) => (
                <li key={r.id} className={`tr-pane__rec ${SEVERITY_TONE[r.severity]}`}>
                  <div className="tr-pane__rec-h">
                    <span className={`tr-pane__chip tr-pane__chip--${r.severity === "critical" ? "bad" : r.severity === "warn" ? "warn" : r.severity === "advice" ? "info" : ""}`}>
                      {r.severity}
                    </span>
                    <span className="tr-pane__chip">{r.origin}</span>
                    <span className="tr-pane__rec-title">{r.title}</span>
                    <span className="tr-pane__rec-impact">{r.impact}</span>
                  </div>
                  <p className="tr-pane__rec-body">{r.body}</p>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>
    </div>
  );
}
