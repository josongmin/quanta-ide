import { useEffect } from "react";
import { GitBranch, ShieldCheck } from "lucide-react";
import { useAutopilot, selectors, autopilotStore } from "@quanta/app-autopilot/stores";
import { Button, Chip, Kbd, StatDot } from "@quanta/app-autopilot/shared/ui/primitives";
import { AbandonCard, MetricDelta, RunStatusChip, Timeline } from "@quanta/app-autopilot/shared/ui/viz";
import type { AutopilotRoute } from "@quanta/app-autopilot/shared/lib";
import { relativeTime } from "@quanta/app-autopilot/shared/lib";
import "./run-detail-page.css";

export interface RunDetailPageProps {
  runId: string;
  navigate: (next: AutopilotRoute, mode?: "push" | "replace") => void;
}

export function RunDetailPage({ runId, navigate }: RunDetailPageProps) {
  const run = useAutopilot(selectors.runById(runId));
  const workItem = useAutopilot((s) =>
    run ? selectors.workItemById(run.workItemId)(s) : undefined,
  );
  const goal = useAutopilot((s) =>
    run?.goalId ? selectors.goalById(run.goalId)(s) : undefined,
  );
  const proof = useAutopilot((s) =>
    run?.proofArtifactId ? selectors.proofById(run.proofArtifactId)(s) : undefined,
  );

  // Live-tick simulator: a running run gets a new "in-progress" step flipped to
  // passed and a new "awaiting" step appended on a 4s cadence. Demo only.
  useEffect(() => {
    if (!run || run.status !== "running") return;
    let cancelled = false;
    const id = window.setTimeout(() => {
      if (cancelled) return;
      const last = run.steps[run.steps.length - 1];
      if (!last || last.status !== "in-progress") return;
      // Flip last in-progress to passed, append a "review pending" step.
      const flipped = { ...last, status: "passed" as const };
      const withFlip = [...run.steps.slice(0, -1), flipped];
      autopilotStore.appendRunStep(run.id, {
        id: `s_tick_${Date.now().toString(36)}`,
        at: new Date().toISOString(),
        kind: "review",
        title: "Preparing proof artifact…",
        detail: "Collecting validation evidence and awaiting metric_engine recomputation.",
        status: "in-progress",
      });
      // Emit replacement of steps by dispatching a bulk update via a dummy append then correcting.
      // Since the store only appends, we simulate by appending a normalized "passed" marker.
      autopilotStore.appendRunStep(run.id, {
        id: `s_tick_pass_${Date.now().toString(36)}`,
        at: new Date().toISOString(),
        kind: last.kind,
        title: `${last.title} — completed`,
        status: "passed",
      });
      void withFlip;
    }, 4500);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [run]);

  if (!run) {
    return (
      <div className="ap-empty">
        <div className="ap-empty__title">Run not found.</div>
        <button type="button" className="ap-linklike" onClick={() => navigate({ page: "runs" })}>
          Back to runs
        </button>
      </div>
    );
  }

  const startedAt = new Date(run.startedAt).getTime();
  const endedAt = run.completedAt ? new Date(run.completedAt).getTime() : Date.now();
  const durationMin = Math.max(1, Math.round((endedAt - startedAt) / 60_000));
  const totalTokens = run.steps.reduce((acc, s) => acc + (s.tokens ?? 0), 0);

  return (
    <div className="ap-run-detail ap-container">
      <header className="ap-detail-head">
        <div className="ap-detail-head__text">
          <div className="ap-run-detail__eyebrow">
            <StatDot
              tone={
                run.status === "running" ? "accent"
                : run.status === "abandoned" ? "warn"
                : run.status === "failed" ? "danger"
                : run.status === "awaiting_review" ? "accent"
                : "success"
              }
              pulse={run.status === "running"}
            />
            <RunStatusChip status={run.status} />
            <span className="ap-run-detail__eyebrow-sep">·</span>
            <span className="ap-mono" style={{ color: "var(--fg-muted)" }}>{run.id}</span>
          </div>
          <h1 className="ap-detail-head__title">
            {workItem?.title ?? `Run ${run.id}`}
          </h1>
          {workItem?.description != null && (
            <p className="ap-detail-head__sub">{workItem.description}</p>
          )}
          <div className="ap-run-detail__meta">
            <Chip tone="muted" leading={<GitBranch size={11} strokeWidth={1.8} aria-hidden />} mono>
              {run.branchName ?? "no branch"}
            </Chip>
            {run.prNumber != null && <Chip tone="accent" mono>PR #{run.prNumber}</Chip>}
            <Chip tone="muted" mono>{run.operatorId}</Chip>
            <Chip tone="muted">{run.mode}</Chip>
            <Chip tone="muted">started {relativeTime(run.startedAt)}</Chip>
            <Chip tone="muted" mono>{durationMin}m</Chip>
            {totalTokens > 0 && (
              <Chip tone="muted" mono>{totalTokens.toLocaleString()} tok</Chip>
            )}
          </div>
        </div>
        <div className="ap-detail-head__actions">
          {run.status === "awaiting_review" && proof != null && (
            <Button
              variant="primary"
              leading={<ShieldCheck size={14} strokeWidth={1.8} aria-hidden />}
              onClick={() => navigate({ page: "proof-detail", id: proof.id })}
            >
              Open proof
            </Button>
          )}
          {goal != null && (
            <Button
              variant="secondary"
              onClick={() => navigate({ page: "goal-detail", id: goal.id })}
            >
              Parent goal
            </Button>
          )}
        </div>
      </header>

      {run.abandon != null && (
        <div className="ap-run-detail__abandon">
          <AbandonCard abandon={run.abandon} />
        </div>
      )}

      <div className="ap-detail-grid">
        <section className="ap-card">
          <div className="ap-card__head">
            <div>
              <div className="ap-card__eyebrow">Timeline</div>
              <div className="ap-card__title">
                {run.steps.length} step{run.steps.length === 1 ? "" : "s"}
              </div>
            </div>
            <span className="ap-card__grow" />
            {run.status === "running" && (
              <Chip tone="accent" mono leading={<StatDot tone="accent" pulse />}>
                live
              </Chip>
            )}
          </div>
          <Timeline steps={run.steps} />
        </section>

        <aside className="ap-run-detail__aside">
          {workItem != null && (
            <section className="ap-card">
              <div className="ap-card__head">
                <div>
                  <div className="ap-card__eyebrow">Work item</div>
                  <div className="ap-card__title">{workItem.title}</div>
                </div>
              </div>
              <dl className="ap-kv">
                <dt>class</dt>
                <dd>{workItem.taskClass.replace(/_/g, " ")}</dd>
                <dt>risk</dt>
                <dd>
                  <Chip
                    tone={workItem.riskTier === "low" ? "success" : workItem.riskTier === "medium" ? "muted" : "warn"}
                  >
                    {workItem.riskTier}
                  </Chip>
                </dd>
                <dt>actions</dt>
                <dd>
                  <div className="ap-run-detail__actions-list">
                    {workItem.selectedActions.map((a) => (
                      <Chip key={a} tone="muted" mono>{a}</Chip>
                    ))}
                  </div>
                </dd>
                {workItem.constraints.doNotTouchPaths != null && (
                  <>
                    <dt>untouchable</dt>
                    <dd>
                      <ul className="ap-run-detail__untouch">
                        {workItem.constraints.doNotTouchPaths.map((p) => (
                          <li key={p} className="ap-mono">{p}</li>
                        ))}
                      </ul>
                    </dd>
                  </>
                )}
                {workItem.constraints.maxFiles != null && (
                  <>
                    <dt>limit</dt>
                    <dd className="ap-mono">
                      ≤ {workItem.constraints.maxFiles} files · ≤ {workItem.constraints.maxChangedLines} lines
                    </dd>
                  </>
                )}
              </dl>
            </section>
          )}

          {workItem?.expectedOutcome.expectedMetricDeltas != null && (
            <section className="ap-card">
              <div className="ap-card__head">
                <div>
                  <div className="ap-card__eyebrow">Expected impact</div>
                  <div className="ap-card__title">Planner estimate</div>
                </div>
              </div>
              <div className="ap-run-detail__expected">
                {workItem.expectedOutcome.expectedMetricDeltas.map((d) => (
                  <MetricDelta
                    key={d.metric}
                    metric={d.metric}
                    before={d.before ?? 0}
                    after={d.after ?? 0}
                    layout="stacked"
                  />
                ))}
              </div>
            </section>
          )}

          <div className="ap-run-detail__hint">
            <Kbd>Esc</Kbd>
            <span>back to runs</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
