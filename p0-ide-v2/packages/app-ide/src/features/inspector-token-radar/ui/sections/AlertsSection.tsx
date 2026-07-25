import type { AgentRun } from "@quanta/app-ide/entities/token-radar";
import { fmtUsd } from "./helpers";

/**
 * Critical alerts — banners that the user MUST see.
 * Order: secret egress (security) > policy violations > stuckness > pingpong.
 * Returns null when nothing to alert (clean run).
 */
export function AlertsSection({ run }: { run: AgentRun }) {
  const hasSecret = run.secretEgress.length > 0;
  const hasViolations = run.violations.some((v) => v.status !== "armed");
  const hasStuck = run.stuckness.probability >= 0.7;
  const hasPingpong = run.pingpong.length > 0;

  if (!hasSecret && !hasViolations && !hasStuck && !hasPingpong) {
    return (
      <div className="tr-pane__alert-clean" role="status">
        <span className="tr-pane__alert-clean-dot" />
        no critical alerts — run is within policy
      </div>
    );
  }

  return (
    <div className="tr-pane__alerts" role="alert">
      {hasSecret && (
        <div className="tr-pane__alert tr-pane__alert--critical">
          <div className="tr-pane__alert-title">
            <span className="tr-pane__alert-icon">●</span>
            secret egress detected
            <span className="tr-pane__alert-count">{run.secretEgress.length}</span>
          </div>
          <ul className="tr-pane__alert-list">
            {run.secretEgress.map((s) => (
              <li key={s.id} className="tr-pane__alert-row">
                <span className="tr-pane__chip tr-pane__chip--bad">{s.severity}</span>
                <span className="tr-pane__chip">{s.pattern}</span>
                <span className="tr-pane__alert-row-body">
                  <span className="tr-pane__mono">{s.preview}</span> from <code>{s.source}</code>
                  <span className="tr-pane__alert-row-sub"> · via {s.agentRole} · {s.remediation}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasViolations && (
        <div className="tr-pane__alert tr-pane__alert--critical">
          <div className="tr-pane__alert-title">
            <span className="tr-pane__alert-icon">▣</span>
            budget guard tripped
            <span className="tr-pane__alert-count">{run.violations.filter((v) => v.status !== "armed").length}</span>
          </div>
          <ul className="tr-pane__alert-list">
            {run.violations.map((v) => (
              <li key={v.id} className="tr-pane__alert-row">
                <span className={`tr-pane__chip tr-pane__chip--${v.status === "armed" ? "info" : "bad"}`}>
                  {v.status}
                </span>
                <span className="tr-pane__alert-row-body">
                  <code>{v.guard}</code> observed <strong>{v.observed}</strong> · threshold {v.threshold}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {hasStuck && (
        <div className="tr-pane__alert tr-pane__alert--warn">
          <div className="tr-pane__alert-title">
            <span className="tr-pane__alert-icon">↻</span>
            stuckness probability {Math.round(run.stuckness.probability * 100)}%
            <span className="tr-pane__alert-tag">{run.stuckness.recommendedAction}</span>
          </div>
          <ul className="tr-pane__alert-reasons">
            {run.stuckness.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {hasPingpong && (
        <div className="tr-pane__alert tr-pane__alert--warn">
          <div className="tr-pane__alert-title">
            <span className="tr-pane__alert-icon">⇄</span>
            cross-agent pingpong
            <span className="tr-pane__alert-count">{run.pingpong.length}</span>
          </div>
          <ul className="tr-pane__alert-list">
            {run.pingpong.map((p) => (
              <li key={p.id} className="tr-pane__alert-row">
                <span className="tr-pane__chip">{p.cycles} cycles</span>
                <span className="tr-pane__alert-row-body">
                  <code>{p.subjectFile}</code> {p.subjectLineSpan} · resolution: {p.resolution}
                  <span className="tr-pane__alert-row-sub">
                    {" "}· wasted ~{fmtUsd(p.cycles * 1.4)} on rebound calls
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
