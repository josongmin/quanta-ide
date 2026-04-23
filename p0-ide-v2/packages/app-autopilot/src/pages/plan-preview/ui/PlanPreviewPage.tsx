import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CircleSlash,
  GitBranch,
  Layers,
  Play,
  ShieldAlert,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import { useAutopilot, selectors } from "@quanta/app-autopilot/stores";
import {
  Button,
  Chip,
  Kbd,
  SectionHeader,
  StatDot,
} from "@quanta/app-autopilot/shared/ui/primitives";
import {
  AutonomyLadder,
  DiffBar,
  MetricDelta,
  RadialGauge,
  ThinkingDots,
} from "@quanta/app-autopilot/shared/ui/viz";
import { evaluateGoal, targetLabel } from "@quanta/app-autopilot/entities/goal";
import { findMetric, formatMetricValue } from "@quanta/app-autopilot/entities/metric";
import type { AutopilotRoute } from "@quanta/app-autopilot/shared/lib";
import "./plan-preview-page.css";

export interface PlanPreviewPageProps {
  goalId: string;
  navigate: (next: AutopilotRoute, mode?: "push" | "replace") => void;
}

/**
 * Plan Preview — a mock Planner pass that shows the end-to-end plan it
 * *would* file for a goal: candidate work items, operator assignment, risk
 * composition, expected metric delta, and required approvals.
 *
 * Layout: Hero (goal+autonomy) → Planner thinking line → Candidate list
 * (selectable) → Candidate detail (right) with expected impact + risks.
 */
export function PlanPreviewPage({ goalId, navigate }: PlanPreviewPageProps) {
  const goal = useAutopilot(selectors.goalById(goalId));
  const status = useAutopilot(selectors.statusFor(goalId));
  const autonomy = useAutopilot((s) =>
    goal ? selectors.autonomyById(goal.autonomyProfile)(s) : undefined,
  );
  const allWorkItems = useAutopilot((s) => s.workItems);
  const workItems = useMemo(
    () =>
      goal
        ? allWorkItems.filter(
            (w) =>
              w.relatedGoals.includes(goalId) &&
              w.status !== "completed" &&
              w.status !== "abandoned",
          )
        : [],
    [allWorkItems, goal, goalId],
  );
  const [activeId, setActiveId] = useState<string | null>(workItems[0]?.id ?? null);
  const [thinking, setThinking] = useState(true);

  // Fake "planner thinking" state for demo.
  useEffect(() => {
    const t = window.setTimeout(() => setThinking(false), 1100);
    return () => window.clearTimeout(t);
  }, [goalId]);

  const active = useMemo(() => workItems.find((w) => w.id === activeId) ?? null, [workItems, activeId]);

  const riskComposition = useMemo(() => {
    const map: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    for (const w of workItems) map[w.riskTier] = (map[w.riskTier] ?? 0) + 1;
    return [
      { id: "low", value: map.low!, label: "low", tone: "success" as const },
      { id: "medium", value: map.medium!, label: "medium", tone: "warn" as const },
      { id: "high", value: map.high!, label: "high", tone: "danger" as const },
      { id: "critical", value: map.critical!, label: "critical", tone: "danger" as const },
    ].filter((s) => s.value > 0);
  }, [workItems]);

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

  const totalExpectedFiles = workItems.reduce(
    (acc, w) => acc + (w.expectedOutcome.expectedFilesTouched ?? 0),
    0,
  );
  const totalExpectedPrs = workItems.reduce(
    (acc, w) => acc + (w.expectedOutcome.expectedPrCount ?? 0),
    0,
  );

  // Aggregate primary goal progress for the radial gauge.
  const primaryTarget = goal.targets[0]!;
  const primaryStatus = status.targets[0]!;
  const baseline = primaryStatus.current - primaryStatus.deltaFromBaseline;
  const { progress } = evaluateGoal(primaryStatus.current, baseline, primaryTarget);
  const primaryDef = findMetric(primaryTarget.metric);

  return (
    <div className="ap-plan ap-container ap-container--wide">
      {/* HERO */}
      <section className="ap-plan__hero">
        <div className="ap-plan__hero-left">
          <span className="ap-plan__eyebrow">
            <Sparkles size={12} strokeWidth={2} aria-hidden />
            <span>PLAN PREVIEW · AUTOPILOT DRY-RUN</span>
          </span>
          <h1 className="ap-plan__title">{goal.name}</h1>
          <p className="ap-plan__sub">
            Planner would dispatch <strong>{workItems.length}</strong> work item
            {workItems.length === 1 ? "" : "s"} across{" "}
            <strong>{new Set(workItems.map((w) => w.operatorId)).size}</strong> operator
            {new Set(workItems.map((w) => w.operatorId)).size === 1 ? "" : "s"}.{" "}
            Nothing lands until you run. Abandon remains first-class.
          </p>

          {autonomy != null && (
            <div className="ap-plan__autonomy">
              <AutonomyLadder level={autonomy.level} />
            </div>
          )}

          <div className="ap-plan__flow" aria-hidden>
            <div className="ap-plan__flow-step">
              <Target size={13} strokeWidth={1.8} aria-hidden /> Goal
            </div>
            <ArrowRight size={12} strokeWidth={1.8} />
            <div className="ap-plan__flow-step">
              <Layers size={13} strokeWidth={1.8} aria-hidden /> Planner
              {thinking && <ThinkingDots />}
            </div>
            <ArrowRight size={12} strokeWidth={1.8} />
            <div className="ap-plan__flow-step">
              <Zap size={13} strokeWidth={1.8} aria-hidden /> Operators
            </div>
            <ArrowRight size={12} strokeWidth={1.8} />
            <div className="ap-plan__flow-step">
              <GitBranch size={13} strokeWidth={1.8} aria-hidden /> Proof PR
            </div>
          </div>
        </div>

        <div className="ap-plan__hero-right">
          <RadialGauge progress={progress} size={136} stroke={12} tone={progress >= 1 ? "good" : "accent"}>
            <span className="ap-plan__gauge-num">{Math.round(progress * 100)}%</span>
            <span className="ap-plan__gauge-label">goal</span>
          </RadialGauge>
          <div className="ap-plan__gauge-meta">
            <div className="ap-plan__gauge-metric">{primaryDef?.name ?? primaryTarget.metric}</div>
            <div className="ap-plan__gauge-line">
              <span className="ap-mono" style={{ color: "var(--fg-subtle)" }}>
                {formatMetricValue(primaryStatus.current, primaryDef?.unit ?? "count")}
              </span>
              <ArrowRight size={10} strokeWidth={2} aria-hidden />
              <span className="ap-mono" style={{ color: "var(--fg)", fontWeight: 600 }}>
                {formatMetricValue(Number(primaryTarget.value), primaryDef?.unit ?? "count")}
              </span>
              <span className="ap-mono" style={{ color: "var(--fg-subtle)" }}>
                {targetLabel(primaryTarget.operator)}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* SUMMARY STATS */}
      <section className="ap-plan__summary">
        <div className="ap-plan__stat">
          <div className="ap-plan__stat-label">work items</div>
          <div className="ap-plan__stat-value">{workItems.length}</div>
        </div>
        <div className="ap-plan__stat">
          <div className="ap-plan__stat-label">files · est</div>
          <div className="ap-plan__stat-value">{totalExpectedFiles}</div>
        </div>
        <div className="ap-plan__stat">
          <div className="ap-plan__stat-label">PRs · est</div>
          <div className="ap-plan__stat-value">{totalExpectedPrs}</div>
        </div>
        <div className="ap-plan__stat ap-plan__stat--wide">
          <div className="ap-plan__stat-label">risk composition</div>
          {riskComposition.length > 0 ? (
            <DiffBar segments={riskComposition} height={8} showLegend />
          ) : (
            <div className="ap-plan__stat-value">—</div>
          )}
        </div>
      </section>

      {/* CANDIDATES + DETAIL */}
      <SectionHeader
        eyebrow="Candidates"
        title="Proposed work items"
        subtitle="Planner assigned each candidate to an operator. Select to inspect expected impact, constraints, and risks. Nothing ships yet."
      />

      <div className="ap-plan__split">
        <ol className="ap-plan__cands">
          {workItems.map((w, i) => (
            <li key={w.id}>
              <button
                type="button"
                className={`ap-plan__cand ${activeId === w.id ? "is-active" : ""}`}
                onClick={() => setActiveId(w.id)}
              >
                <span className="ap-plan__cand-idx">#{i + 1}</span>
                <div className="ap-plan__cand-body">
                  <div className="ap-plan__cand-head">
                    <span className="ap-plan__cand-title">{w.title}</span>
                    <Chip tone={w.riskTier === "low" ? "success" : w.riskTier === "medium" ? "muted" : "warn"}>
                      {w.riskTier}
                    </Chip>
                  </div>
                  <div className="ap-plan__cand-meta">
                    <Chip tone="muted" mono>{w.operatorId}</Chip>
                    <Chip tone="muted">{w.taskClass.replace(/_/g, " ")}</Chip>
                    {w.source.kind === "opportunity_engine" && (
                      <Chip tone="accent" leading={<Sparkles size={10} strokeWidth={2} aria-hidden />}>
                        opportunity
                      </Chip>
                    )}
                  </div>
                </div>
              </button>
            </li>
          ))}
          {workItems.length === 0 && (
            <li className="ap-empty">
              <div className="ap-empty__title">Planner produced no candidates.</div>
              <div className="ap-empty__sub">
                Goal may already be satisfied, or no operator can reduce it without
                touching protected zones.
              </div>
            </li>
          )}
        </ol>

        <aside className="ap-plan__detail">
          {active == null ? (
            <div className="ap-empty">
              <div className="ap-empty__title">Select a candidate</div>
              <div className="ap-empty__sub">See expected impact, constraints, and required proof.</div>
            </div>
          ) : (
            <>
              <div className="ap-plan__detail-head">
                <h2 className="ap-plan__detail-title">{active.title}</h2>
                <p className="ap-plan__detail-sub">{active.description}</p>
              </div>

              <section className="ap-card ap-card--tight ap-plan__impact">
                <div className="ap-card__head">
                  <div className="ap-card__eyebrow">Expected impact</div>
                </div>
                {active.expectedOutcome.expectedMetricDeltas != null &&
                active.expectedOutcome.expectedMetricDeltas.length > 0 ? (
                  <div className="ap-plan__deltas">
                    {active.expectedOutcome.expectedMetricDeltas.map((d) => (
                      <MetricDelta
                        key={d.metric}
                        metric={d.metric}
                        before={d.before ?? 0}
                        after={d.after ?? 0}
                        layout="stacked"
                      />
                    ))}
                  </div>
                ) : (
                  <div className="ap-plan__muted">No metric movement estimated.</div>
                )}
              </section>

              <section className="ap-card ap-card--tight">
                <div className="ap-card__head">
                  <div className="ap-card__eyebrow">Constraints</div>
                </div>
                <dl className="ap-kv">
                  <dt>preserve API</dt>
                  <dd>{active.constraints.preservePublicApi ? "yes" : "no"}</dd>
                  <dt>preserve semantics</dt>
                  <dd>{active.constraints.preserveRuntimeSemantics ? "yes" : "no"}</dd>
                  {active.constraints.maxFiles != null && (
                    <>
                      <dt>limit</dt>
                      <dd className="ap-mono">
                        ≤ {active.constraints.maxFiles} files · ≤ {active.constraints.maxChangedLines} lines
                      </dd>
                    </>
                  )}
                  {active.constraints.doNotTouchPaths != null && active.constraints.doNotTouchPaths.length > 0 && (
                    <>
                      <dt>untouchable</dt>
                      <dd>
                        <ul className="ap-plan__untouch">
                          {active.constraints.doNotTouchPaths.map((p) => (
                            <li key={p}>
                              <CircleSlash size={10} strokeWidth={2} aria-hidden />
                              <code className="ap-mono">{p}</code>
                            </li>
                          ))}
                        </ul>
                      </dd>
                    </>
                  )}
                </dl>
              </section>

              <section className="ap-card ap-card--tight">
                <div className="ap-card__head">
                  <div className="ap-card__eyebrow">Proof requirements</div>
                </div>
                <div className="ap-plan__proof-list">
                  {active.proofRequirements.map((r) => (
                    <Chip key={r} tone="muted" mono>{r}</Chip>
                  ))}
                </div>
              </section>

              {active.riskTier !== "low" && (
                <section className="ap-plan__risk-callout">
                  <AlertTriangle size={14} strokeWidth={1.8} aria-hidden />
                  <div>
                    <div className="ap-plan__risk-callout-title">
                      Requires checkpoint review
                    </div>
                    <div className="ap-plan__risk-callout-sub">
                      {autonomy != null && autonomy.requiresCheckpointReview
                        ? `Your autonomy profile "${autonomy.name}" requires human approval before merge.`
                        : "Risk tier above autonomy envelope. Escalate to a higher-tier profile or narrow scope."}
                    </div>
                  </div>
                </section>
              )}
            </>
          )}
        </aside>
      </div>

      {/* ACTION STRIP */}
      <footer className="ap-plan__foot">
        <div className="ap-plan__foot-left">
          <StatDot tone="accent" pulse={thinking} />
          <span className="ap-plan__foot-text">
            {thinking ? "Planner is resolving…" : "Plan ready. No code has been changed."}
          </span>
        </div>
        <div className="ap-plan__foot-right">
          <Button
            variant="secondary"
            leading={<ShieldAlert size={13} strokeWidth={1.8} aria-hidden />}
            onClick={() => navigate({ page: "goal-detail", id: goalId })}
          >
            Refine goal
          </Button>
          <Button
            variant="primary"
            leading={<Play size={13} strokeWidth={1.8} aria-hidden />}
            kbd="⌘↵"
            onClick={() => navigate({ page: "runs" })}
          >
            Dispatch {workItems.length} work item{workItems.length === 1 ? "" : "s"}
          </Button>
        </div>
      </footer>
      <div className="ap-plan__hint">
        <Kbd>Esc</Kbd> back to goal
      </div>
    </div>
  );
}
