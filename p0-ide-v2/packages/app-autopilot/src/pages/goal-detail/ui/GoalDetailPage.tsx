import { Play, ShieldCheck, Target } from "lucide-react";
import { useAutopilot, selectors } from "@quanta/app-autopilot/stores";
import { Button, Chip, Kbd } from "@quanta/app-autopilot/shared/ui/primitives";
import { AutonomyLadder, Gauge, Sparkline } from "@quanta/app-autopilot/shared/ui/viz";
import { evaluateGoal, targetLabel } from "@quanta/app-autopilot/entities/goal";
import { findMetric, formatMetricValue } from "@quanta/app-autopilot/entities/metric";
import type { AutopilotRoute } from "@quanta/app-autopilot/shared/lib";
import { relativeTime } from "@quanta/app-autopilot/shared/lib";
import "./goal-detail-page.css";

export interface GoalDetailPageProps {
  goalId: string;
  navigate: (next: AutopilotRoute, mode?: "push" | "replace") => void;
}

export function GoalDetailPage({ goalId, navigate }: GoalDetailPageProps) {
  const goal = useAutopilot(selectors.goalById(goalId));
  const status = useAutopilot(selectors.statusFor(goalId));
  const runs = useAutopilot(selectors.runsForGoal(goalId));
  const workItems = useAutopilot(selectors.workItemsForGoal(goalId));
  const autonomy = useAutopilot((s) =>
    goal ? selectors.autonomyById(goal.autonomyProfile)(s) : undefined,
  );

  if (!goal || !status) {
    return (
      <div className="ap-empty">
        <div className="ap-empty__title">Goal not found.</div>
        <button type="button" className="ap-linklike" onClick={() => navigate({ page: "goals" })}>
          Back to goals
        </button>
      </div>
    );
  }

  return (
    <div className="ap-goal-detail ap-container">
      <header className="ap-detail-head">
        <div className="ap-detail-head__text">
          <div className="ap-goal-detail__eyebrow">
            <Target size={12} strokeWidth={2} aria-hidden />
            <span>GOAL · {goal.mode}</span>
            {goal.owner != null && (
              <>
                <span className="ap-goal-detail__eyebrow-sep">·</span>
                <span>{goal.owner.displayName}</span>
              </>
            )}
          </div>
          <h1 className="ap-detail-head__title">{goal.name}</h1>
          {goal.description != null && <p className="ap-detail-head__sub">{goal.description}</p>}
          <div className="ap-goal-detail__meta">
            <Chip tone="muted">
              scope ·{" "}
              {goal.scope.repo ? "repo-wide" : `${goal.scope.paths?.length ?? 0} path${goal.scope.paths?.length === 1 ? "" : "s"}`}
            </Chip>
            <Chip tone="muted" mono>{goal.autonomyProfile}</Chip>
            <Chip tone="muted">
              budget · {goal.executionBudget.maxPrsPerRun} PRs · {goal.executionBudget.maxFilesPerPr} files
            </Chip>
            <Chip tone="muted">
              evaluated {relativeTime(status.lastEvaluatedAt)}
            </Chip>
          </div>
        </div>
        <div className="ap-detail-head__actions">
          <Button
            variant="secondary"
            leading={<Play size={14} strokeWidth={1.8} aria-hidden />}
            onClick={() => navigate({ page: "plan-preview", goalId: goal.id })}
          >
            Preview plan
          </Button>
          <Button
            variant="primary"
            kbd="R"
            onClick={() => navigate({ page: "plan-preview", goalId: goal.id })}
          >
            Run now
          </Button>
        </div>
      </header>

      <div className="ap-detail-grid ap-detail-grid--wide-aside">
        {/* MAIN — targets, guardrails, runs */}
        <div className="ap-goal-detail__main">
          <section className="ap-card">
            <div className="ap-card__head">
              <div>
                <div className="ap-card__eyebrow">Targets</div>
                <div className="ap-card__title">How this goal evaluates</div>
              </div>
            </div>
            <ul className="ap-goal-detail__targets">
              {goal.targets.map((t, i) => {
                const ts = status.targets.find((x) => x.metric === t.metric);
                if (!ts) return null;
                const baseline = ts.current - ts.deltaFromBaseline;
                const { progress, satisfied } = evaluateGoal(ts.current, baseline, t);
                const def = findMetric(t.metric);
                return (
                  <li key={i} className="ap-goal-detail__target">
                    <div className="ap-goal-detail__target-head">
                      <span className="ap-goal-detail__target-name">{def?.name ?? t.metric}</span>
                      <span className="ap-goal-detail__target-rule">
                        {targetLabel(t.operator)} {formatMetricValue(Number(t.value), def?.unit ?? "count")}
                      </span>
                      <Chip
                        tone={satisfied ? "success" : progress > 0.5 ? "muted" : "warn"}
                      >
                        {satisfied ? "met" : `${Math.round(progress * 100)}%`}
                      </Chip>
                    </div>
                    {t.narrativeIntent != null && (
                      <div className="ap-goal-detail__target-intent">
                        <span className="ap-goal-detail__target-intent-label">Intent</span>
                        <span>{t.narrativeIntent}</span>
                      </div>
                    )}
                    <div className="ap-goal-detail__target-body">
                      <Gauge
                        progress={progress}
                        tone={satisfied ? "good" : progress > 0.5 ? "neutral" : "warn"}
                        variant="full"
                        label={`baseline ${formatMetricValue(baseline, def?.unit ?? "count")} → current ${formatMetricValue(ts.current, def?.unit ?? "count")} → target ${formatMetricValue(Number(t.value), def?.unit ?? "count")}`}
                        endBadge={def?.direction === "lower-better" ? "lower-better" : def?.direction === "higher-better" ? "higher-better" : "neutral"}
                      />
                      <Sparkline
                        values={ts.history ?? []}
                        tone={satisfied ? "good" : "neutral"}
                        target={Number(t.value)}
                        baseline={baseline}
                        width={220}
                        height={40}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {goal.guardrails.length > 0 && (
            <section className="ap-card">
              <div className="ap-card__head">
                <div>
                  <div className="ap-card__eyebrow">Guardrails</div>
                  <div className="ap-card__title">What must never happen</div>
                </div>
              </div>
              <ul className="ap-goal-detail__guardrails">
                {goal.guardrails.map((g, i) => {
                  const def = findMetric(g.metric);
                  return (
                    <li key={i}>
                      <Chip tone={g.severity === "block" ? "danger" : "warn"} leading={<ShieldCheck size={11} strokeWidth={2} aria-hidden />}>
                        {g.severity}
                      </Chip>
                      <span className="ap-goal-detail__guardrail-rule">
                        <span className="ap-mono">{def?.name ?? g.metric}</span>{" "}
                        {targetLabel(g.operator)}{" "}
                        <span className="ap-mono">{String(g.value)}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section className="ap-card">
            <div className="ap-card__head">
              <div>
                <div className="ap-card__eyebrow">Reconciliation</div>
                <div className="ap-card__title">Recent runs · work in flight</div>
              </div>
            </div>
            {runs.length === 0 ? (
              <div className="ap-empty">
                <div className="ap-empty__title">No runs yet.</div>
                <div className="ap-empty__sub">
                  Preview a plan or run now. Autopilot will file a proof-backed PR when it finishes.
                </div>
              </div>
            ) : (
              <ul className="ap-goal-detail__runs">
                {runs.slice(0, 8).map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      className="ap-goal-detail__run"
                      onClick={() => navigate({ page: "run-detail", id: r.id })}
                    >
                      <div className="ap-goal-detail__run-left">
                        <span className={`ap-goal-detail__run-dot is-${r.status}`} aria-hidden />
                        <span className="ap-goal-detail__run-op">{r.operatorId}</span>
                        <span className="ap-goal-detail__run-branch">{r.branchName ?? "—"}</span>
                      </div>
                      <div className="ap-goal-detail__run-right">
                        <span className="ap-goal-detail__run-status">{r.status.replace("_", " ")}</span>
                        <span className="ap-goal-detail__run-when">{relativeTime(r.startedAt)}</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* ASIDE */}
        <aside className="ap-goal-detail__aside">
          {autonomy != null && (
            <section className="ap-card">
              <div className="ap-card__head">
                <div>
                  <div className="ap-card__eyebrow">Autonomy</div>
                  <div className="ap-card__title">{autonomy.name}</div>
                </div>
              </div>
              <AutonomyLadder level={autonomy.level} />
              <p className="ap-goal-detail__autonomy-desc">{autonomy.description}</p>
              <dl className="ap-kv">
                <dt>mode</dt>
                <dd>{autonomy.executionMode}</dd>
                <dt>risk</dt>
                <dd>{autonomy.allowedRisk.length > 0 ? autonomy.allowedRisk.join(" · ") : "—"}</dd>
                <dt>auto PR</dt>
                <dd>{autonomy.allowsAutoPr ? "yes" : "no"}</dd>
                <dt>checkpoint</dt>
                <dd>{autonomy.requiresCheckpointReview ? "required" : "optional"}</dd>
              </dl>
            </section>
          )}

          <section className="ap-card">
            <div className="ap-card__head">
              <div>
                <div className="ap-card__eyebrow">Work</div>
                <div className="ap-card__title">{workItems.length} items</div>
              </div>
            </div>
            <ul className="ap-goal-detail__wi">
              {workItems.slice(0, 5).map((w) => (
                <li key={w.id}>
                  <span className={`ap-goal-detail__wi-dot is-${w.status}`} aria-hidden />
                  <span className="ap-goal-detail__wi-title">{w.title}</span>
                  <span className="ap-goal-detail__wi-op">{w.operatorId}</span>
                </li>
              ))}
            </ul>
            {workItems.length === 0 && (
              <div className="ap-goal-detail__empty-inline">No queued work.</div>
            )}
          </section>

          <section className="ap-card ap-card--muted">
            <div className="ap-card__head">
              <div>
                <div className="ap-card__eyebrow">Metric versions</div>
                <div className="ap-card__title">Frozen for this goal</div>
              </div>
            </div>
            <dl className="ap-kv">
              {Object.entries(goal.metricVersionSet).map(([k, v]) => (
                <div key={k} style={{ display: "contents" }}>
                  <dt>{k}</dt>
                  <dd className="ap-mono">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="ap-goal-detail__baseline">
              <span>baseline</span>
              <code className="ap-mono">{goal.baselineSnapshotId}</code>
            </div>
          </section>

          <div className="ap-goal-detail__hint">
            <Kbd>Esc</Kbd>
            <span>back to goals</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
