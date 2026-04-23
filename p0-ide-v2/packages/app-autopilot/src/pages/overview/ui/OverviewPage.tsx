import { useMemo, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Orbit,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { useAutopilot, selectors, autopilotStore } from "@quanta/app-autopilot/stores";
import {
  Chip,
  SectionHeader,
  StatDot,
  Kbd,
} from "@quanta/app-autopilot/shared/ui/primitives";
import {
  AutonomyLadder,
  Gauge,
  InboxCard,
  Sparkline,
} from "@quanta/app-autopilot/shared/ui/viz";
import type { AutopilotRoute } from "@quanta/app-autopilot/shared/lib";
import { evaluateGoal } from "@quanta/app-autopilot/entities/goal";
import { findMetric } from "@quanta/app-autopilot/entities/metric";
import { AUTONOMY_LEVEL_META } from "@quanta/app-autopilot/entities/autonomy";
import "./overview-page.css";

export interface OverviewPageProps {
  navigate: (next: AutopilotRoute, mode?: "push" | "replace") => void;
}

export function OverviewPage({ navigate }: OverviewPageProps) {
  const inbox = useAutopilot((s) => selectors.liveInbox(s));
  const goals = useAutopilot((s) => s.goals);
  const goalStatus = useAutopilot((s) => s.goalStatus);
  const runs = useAutopilot((s) => s.runs);
  const proofs = useAutopilot((s) => s.proofs);
  const snapshot = useAutopilot((s) => s.snapshot);
  const autonomyProfiles = useAutopilot((s) => s.autonomyProfiles);

  const [activeInboxId, setActiveInboxId] = useState<string | null>(inbox[0]?.id ?? null);

  const runsRunning = runs.filter((r) => r.status === "running").length;
  const runsAwaiting = runs.filter((r) => r.status === "awaiting_review").length;
  const runsAbandoned7d = runs.filter((r) => r.status === "abandoned").length;
  const recentProofs = proofs.slice(0, 3);

  const avgProgress = useMemo(() => {
    if (goalStatus.length === 0) return 0;
    let sum = 0;
    let n = 0;
    for (const gs of goalStatus) {
      const g = goals.find((x) => x.id === gs.goalId);
      if (!g) continue;
      for (const ts of gs.targets) {
        const t = g.targets.find((x) => x.metric === ts.metric);
        if (!t) continue;
        const baseline = ts.current - ts.deltaFromBaseline;
        const { progress } = evaluateGoal(ts.current, baseline, t);
        sum += progress;
        n += 1;
      }
    }
    return n > 0 ? sum / n : 0;
  }, [goalStatus, goals]);

  const handleActivateInbox = (id: string) => {
    setActiveInboxId(id);
    const item = inbox.find((x) => x.id === id);
    if (!item || !item.target) return;
    const t = item.target;
    if (t.kind === "run") navigate({ page: "run-detail", id: t.id });
    else if (t.kind === "goal") navigate({ page: "goal-detail", id: t.id });
    else if (t.kind === "proof") navigate({ page: "proof-detail", id: t.id });
    else if (t.kind === "opportunity") navigate({ page: "opportunities" });
    else if (t.kind === "workitem") navigate({ page: "workitems" });
  };

  return (
    <div className="ap-overview ap-container ap-container--wide">
      {/* HERO — framing + autonomy posture + key stats */}
      <section className="ap-overview__hero">
        <div className="ap-overview__hero-text">
          <span className="ap-overview__eyebrow">
            <Orbit size={12} strokeWidth={2} aria-hidden />
            <span>Autonomous Repo Engineer · v0 exploratory</span>
          </span>
          <h1 className="ap-overview__title">
            Goals-driven, <em>opportunity-aware</em> repo autopilot.
          </h1>
          <p className="ap-overview__sub">
            Goals steer. Operators execute. Proof-carrying changes land in review. Abandon
            is a first-class outcome when the path is unsafe.
          </p>
          <div className="ap-overview__ladders">
            {autonomyProfiles.slice(0, 3).map((p) => (
              <button
                key={p.id}
                type="button"
                className="ap-overview__ladder"
                onClick={() => navigate({ page: "goals" })}
                title={p.description}
              >
                <AutonomyLadder level={p.level} />
                <span className="ap-overview__ladder-name">{p.name}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="ap-overview__hero-stats">
          <HeroStat
            title="Goal progress"
            value={`${Math.round(avgProgress * 100)}%`}
            sub={`${goals.length} active goals`}
            trend={<Sparkline values={[0.30, 0.42, 0.48, 0.52, 0.61, avgProgress]} tone="good" width={84} height={26} />}
          />
          <HeroStat
            title="Runs in flight"
            value={`${runsRunning}`}
            sub={`${runsAwaiting} awaiting review · ${runsAbandoned7d} abandoned (7d)`}
            trend={
              <span className="ap-overview__stat-pulse">
                <StatDot tone="accent" pulse />
                <span>live</span>
              </span>
            }
          />
          <HeroStat
            title="Verifier-backed proofs"
            value={`${proofs.length}`}
            sub={`${recentProofs.filter((p) => p.computedBy === "metric_engine").length} engine-verified`}
            trend={
              <Chip tone="success" mono leading={<ShieldCheck size={11} strokeWidth={2} aria-hidden />}>
                ok
              </Chip>
            }
          />
        </div>
      </section>

      {/* INBOX — primary triage surface */}
      <section className="ap-overview__inbox">
        <SectionHeader
          eyebrow="Inbox"
          title="What needs you now"
          subtitle={`${inbox.length} item${inbox.length === 1 ? "" : "s"} · triage with J/K · open with Enter · dismiss with X`}
          trailing={
            <Chip tone="muted">
              <Kbd>J/K</Kbd>
              <span style={{ marginLeft: 4 }}>navigate</span>
            </Chip>
          }
        />
        <div className="ap-overview__inbox-list" onKeyDown={(e) => handleInboxKey(e, inbox, activeInboxId, setActiveInboxId, handleActivateInbox)}>
          {inbox.length === 0 && (
            <div className="ap-empty">
              <div className="ap-empty__title">Inbox is clear.</div>
              <div className="ap-empty__sub">
                Autopilot keeps watching. New review requests, abandoned runs, and opportunities will surface here.
              </div>
            </div>
          )}
          {inbox.map((it) => (
            <InboxCard
              key={it.id}
              item={it}
              active={activeInboxId === it.id}
              onActivate={() => handleActivateInbox(it.id)}
              onDismiss={() => autopilotStore.dismissInboxItem(it.id)}
            />
          ))}
        </div>
      </section>

      {/* GOAL PROGRESS STRIP */}
      <section className="ap-overview__goals">
        <SectionHeader
          eyebrow="Goals"
          title="Target vs. actual"
          subtitle="Live progress from current snapshot. Click a card to inspect."
          trailing={
            <button
              type="button"
              className="ap-linklike"
              onClick={() => navigate({ page: "goals" })}
            >
              All goals <ArrowUpRight size={12} strokeWidth={2} aria-hidden />
            </button>
          }
        />
        <div className="ap-overview__goal-strip">
          {goals.map((g) => {
            const status = goalStatus.find((s) => s.goalId === g.id);
            if (!status) return null;
            const primaryTarget = g.targets[0]!;
            const primaryStatus = status.targets[0]!;
            const baseline = primaryStatus.current - primaryStatus.deltaFromBaseline;
            const { progress } = evaluateGoal(primaryStatus.current, baseline, primaryTarget);
            const metricDef = findMetric(primaryTarget.metric);
            return (
              <button
                key={g.id}
                type="button"
                className="ap-overview__goal-card"
                onClick={() => navigate({ page: "goal-detail", id: g.id })}
              >
                <div className="ap-overview__goal-card-head">
                  <span className="ap-overview__goal-name">{g.name}</span>
                  <Chip tone={g.mode === "enforce" ? "accent" : "muted"}>{g.mode}</Chip>
                </div>
                <Gauge
                  progress={progress}
                  tone={progress >= 0.99 ? "good" : progress > 0.5 ? "neutral" : "warn"}
                  variant="full"
                  label={`${metricDef?.name ?? primaryTarget.metric} · ${primaryStatus.current} → ${primaryTarget.value}`}
                  endBadge={`${status.activeWorkItemCount} in flight`}
                />
                <div className="ap-overview__goal-card-meta">
                  <Sparkline
                    values={primaryStatus.history ?? []}
                    tone={progress > 0.5 ? "good" : "neutral"}
                    target={Number(primaryTarget.value)}
                    width={180}
                    height={24}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* BOTTOM: activity + recent proofs */}
      <section className="ap-overview__split">
        <div className="ap-overview__split-col">
          <SectionHeader eyebrow="Activity" title="Runs · last 24h" trailing={
            <button type="button" className="ap-linklike" onClick={() => navigate({ page: "runs" })}>
              All runs <ArrowUpRight size={12} strokeWidth={2} aria-hidden />
            </button>
          } />
          <ul className="ap-overview__activity">
            {runs.slice(0, 5).map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className="ap-overview__activity-row"
                  onClick={() => navigate({ page: "run-detail", id: r.id })}
                >
                  <StatDot
                    tone={
                      r.status === "running" ? "accent"
                      : r.status === "abandoned" ? "warn"
                      : r.status === "failed" ? "danger"
                      : r.status === "awaiting_review" ? "accent"
                      : "success"
                    }
                    pulse={r.status === "running"}
                  />
                  <span className="ap-overview__activity-op">{r.operatorId}</span>
                  <span className="ap-overview__activity-branch">{r.branchName ?? "—"}</span>
                  <span className="ap-overview__activity-status">{r.status.replace("_", " ")}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="ap-overview__split-col">
          <SectionHeader eyebrow="Proof" title="Latest verifier-backed" trailing={
            <Chip tone="success" mono leading={<Activity size={11} strokeWidth={2} aria-hidden />}>
              engine
            </Chip>
          } />
          <ul className="ap-overview__proofs">
            {recentProofs.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="ap-overview__proof-row"
                  onClick={() => navigate({ page: "proof-detail", id: p.id })}
                >
                  <div className="ap-overview__proof-head">
                    <span className="ap-overview__proof-op">{p.operatorId}</span>
                    <Chip tone={p.reviewerRecommendation.kind === "skip" ? "success" : p.reviewerRecommendation.kind === "focus" ? "warn" : "accent"}>
                      {p.reviewerRecommendation.kind}
                    </Chip>
                  </div>
                  <div className="ap-overview__proof-deltas">
                    {p.metricDiffs.slice(0, 2).map((d) => {
                      const def = findMetric(d.metric);
                      return (
                        <span key={d.metric} className="ap-overview__proof-delta">
                          {def?.name ?? d.metric} <strong>{d.before} → {d.after}</strong>
                        </span>
                      );
                    })}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <footer className="ap-overview__foot">
        <TrendingUp size={12} strokeWidth={2} aria-hidden />
        <span>
          Snapshot <span className="ap-mono">{snapshot.id}</span> ·{" "}
          {AUTONOMY_LEVEL_META[2].title.toLowerCase()} is the default autonomy band.
        </span>
      </footer>
    </div>
  );
}

function HeroStat({
  title,
  value,
  sub,
  trend,
}: {
  title: string;
  value: string;
  sub: string;
  trend: React.ReactNode;
}) {
  return (
    <div className="ap-overview__stat">
      <div className="ap-overview__stat-title">{title}</div>
      <div className="ap-overview__stat-value">{value}</div>
      <div className="ap-overview__stat-sub">{sub}</div>
      <div className="ap-overview__stat-trend">{trend}</div>
    </div>
  );
}

function handleInboxKey(
  e: React.KeyboardEvent,
  items: readonly { id: string }[],
  activeId: string | null,
  setActive: (id: string) => void,
  onActivate: (id: string) => void,
) {
  if (items.length === 0) return;
  const idx = items.findIndex((x) => x.id === activeId);
  if (e.key === "j") {
    e.preventDefault();
    const next = items[Math.min(items.length - 1, idx + 1)]!;
    setActive(next.id);
  } else if (e.key === "k") {
    e.preventDefault();
    const prev = items[Math.max(0, idx - 1)]!;
    setActive(prev.id);
  } else if (e.key === "Enter") {
    if (activeId) onActivate(activeId);
  }
}
