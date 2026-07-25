import type { AgentRun } from "@quanta/app-ide/entities/token-radar";
import {
  STATUS_LABEL,
  fmtTokens,
  fmtUsd,
  fmtMs,
  gradeToneCls,
  statusToneCls,
  SectionTitle,
} from "./helpers";

/**
 * TIER 2 — Tasks list. Most user-facing table — "which task burned $$".
 * Tasks that touch the focused file are highlighted with a side rail.
 */
export function TasksSection({ run, fileTouchingIds }: { run: AgentRun; fileTouchingIds: string[] }) {
  const focused = new Set(fileTouchingIds);
  return (
    <div className="tr-pane__section">
      <SectionTitle
        tier="t2"
        title="Tasks"
        hint="ordered by cost — focused-file tasks pinned"
        badge={`${run.tasks.length}`}
      />

      <div className="tr-pane__tasks">
        <div className="tr-pane__tasks-head">
          <span>task</span>
          <span>tokens</span>
          <span>cost</span>
          <span>tools</span>
          <span>retries</span>
          <span>duration</span>
          <span>eff</span>
          <span>status</span>
        </div>
        {run.tasks
          .slice()
          .sort((a, b) => b.costUsd - a.costUsd)
          .map((t) => {
            const isFocused = focused.has(t.taskId);
            return (
              <div
                key={t.taskId}
                className={`tr-pane__tasks-row${isFocused ? " is-focused" : ""}${t.stuckness >= 0.7 ? " is-stuck" : ""}`}
              >
                <div className="tr-pane__tasks-cell tr-pane__tasks-cell--id">
                  <code className="tr-pane__mono">{t.taskId}</code>
                  <span className="tr-pane__tasks-title">{t.title}</span>
                  {t.stuckness >= 0.7 && <span className="tr-pane__chip tr-pane__chip--warn">stuck</span>}
                </div>
                <span className="tr-pane__tasks-cell tr-pane__mono">{fmtTokens(t.totalTokens)}</span>
                <span className="tr-pane__tasks-cell tr-pane__mono">{fmtUsd(t.costUsd)}</span>
                <span className="tr-pane__tasks-cell tr-pane__mono">{t.toolCalls}</span>
                <span className={`tr-pane__tasks-cell tr-pane__mono${t.retries >= 3 ? " tr-pane__tasks-cell--bad" : ""}`}>
                  {t.retries}
                </span>
                <span className="tr-pane__tasks-cell tr-pane__mono">{fmtMs(t.durationMs)}</span>
                <span className={`tr-pane__tasks-cell tr-pane__grade-cell ${gradeToneCls(t.efficiencyGrade)}`}>
                  {t.efficiencyGrade}
                </span>
                <span className={`tr-pane__tasks-cell tr-pane__pill ${statusToneCls(t.status)}`}>
                  <span className="tr-pane__pill-dot" />
                  {STATUS_LABEL[t.status]}
                </span>
              </div>
            );
          })}
      </div>
    </div>
  );
}
