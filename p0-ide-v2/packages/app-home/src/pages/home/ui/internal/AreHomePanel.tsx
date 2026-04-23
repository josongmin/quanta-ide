import { useMemo } from "react";
import { ArrowRight, Inbox, Orbit, ShieldCheck, Target } from "lucide-react";
import { tabBus } from "@quanta/shell/stores/tab-bus";
import { useAutopilot, selectors } from "@quanta/app-autopilot/stores";
import {
  Chip,
  StatDot,
} from "@quanta/app-autopilot/shared/ui/primitives";
import {
  InboxCard,
  Sparkline,
} from "@quanta/app-autopilot/shared/ui/viz";
import { evaluateGoal } from "@quanta/app-autopilot/entities/goal";
import type { InboxItem } from "@quanta/app-autopilot/entities/inbox";
import "./are-home-panel.css";

export function AreHomePanel() {
  const inbox = useAutopilot((s) => selectors.liveInbox(s));
  const goals = useAutopilot((s) => s.goals);
  const goalStatus = useAutopilot((s) => s.goalStatus);
  const runs = useAutopilot((s) => s.runs);
  const proofs = useAutopilot((s) => s.proofs);

  const runsRunning = runs.filter((r) => r.status === "running").length;
  const runsAwaiting = runs.filter((r) => r.status === "awaiting_review").length;

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

  const jumpInbox = (item: InboxItem) => {
    if (item.target == null) {
      tabBus.open("autopilot", "Autopilot");
      return;
    }
    const t = item.target;
    if (t.kind === "run") {
      tabBus.open("autopilot", "Autopilot · Run", {
        route: { path: ["runs", t.id] },
      });
    } else if (t.kind === "goal") {
      tabBus.open("autopilot", "Autopilot · Goal", {
        route: { path: ["goals", t.id] },
      });
    } else if (t.kind === "proof") {
      tabBus.open("autopilot", "Autopilot · Proof", {
        route: { path: ["proofs", t.id] },
      });
    } else if (t.kind === "opportunity") {
      tabBus.open("autopilot", "Autopilot · Opportunities", {
        route: { path: ["opportunities"] },
      });
    } else if (t.kind === "workitem") {
      tabBus.open("autopilot", "Autopilot · Work", {
        route: { path: ["workitems"] },
      });
    } else {
      tabBus.open("autopilot", "Autopilot");
    }
  };

  return (
    <div className="are-home">
      <header className="are-home__hero">
        <span className="are-home__eyebrow">
          <Orbit size={12} strokeWidth={2} aria-hidden />
          <span>AUTONOMOUS REPO ENGINEER</span>
        </span>
        <h1 className="are-home__title">
          Goals steer, operators execute, <em>proofs</em> ship.
        </h1>
        <p className="are-home__sub">
          Autopilot is watching your repo. Pick up what needs you, or open the control plane.
        </p>

        <div className="are-home__stats">
          <button
            type="button"
            className="are-home__stat"
            onClick={() =>
              tabBus.open("autopilot", "Autopilot · Goals", {
                route: { path: ["goals"] },
              })
            }
          >
            <span className="are-home__stat-eyebrow">
              <Target size={11} strokeWidth={2} aria-hidden />
              Goal progress
            </span>
            <span className="are-home__stat-value">{Math.round(avgProgress * 100)}%</span>
            <span className="are-home__stat-sub">{goals.length} active goals</span>
            <Sparkline
              values={[0.3, 0.42, 0.48, 0.52, 0.61, avgProgress]}
              tone="good"
              width={96}
              height={22}
              showEndpoint
            />
          </button>

          <button
            type="button"
            className="are-home__stat"
            onClick={() =>
              tabBus.open("autopilot", "Autopilot · Runs", {
                route: { path: ["runs"] },
              })
            }
          >
            <span className="are-home__stat-eyebrow">
              <StatDot tone="accent" pulse={runsRunning > 0} />
              Runs in flight
            </span>
            <span className="are-home__stat-value">{runsRunning}</span>
            <span className="are-home__stat-sub">
              {runsAwaiting} awaiting review
            </span>
          </button>

          <button
            type="button"
            className="are-home__stat"
            onClick={() => tabBus.open("autopilot", "Autopilot")}
          >
            <span className="are-home__stat-eyebrow">
              <ShieldCheck size={11} strokeWidth={2} aria-hidden />
              Verifier-backed proofs
            </span>
            <span className="are-home__stat-value">{proofs.length}</span>
            <span className="are-home__stat-sub">
              {proofs.filter((p) => p.computedBy === "metric_engine").length} engine-verified
            </span>
          </button>
        </div>
      </header>

      <section className="are-home__inbox-section">
        <div className="are-home__section-head">
          <div className="are-home__section-text">
            <div className="are-home__section-eyebrow">
              <Inbox size={12} strokeWidth={2} aria-hidden />
              <span>INBOX</span>
            </div>
            <div className="are-home__section-title">What needs you now</div>
          </div>
          <button
            type="button"
            className="are-home__section-link"
            onClick={() => tabBus.open("autopilot", "Autopilot")}
          >
            Open Autopilot <ArrowRight size={12} strokeWidth={2} aria-hidden />
          </button>
        </div>

        {inbox.length === 0 ? (
          <div className="are-home__empty">
            <div className="are-home__empty-title">Inbox is clear.</div>
            <div className="are-home__empty-sub">
              Autopilot is watching. New review requests, abandoned runs, and
              opportunities surface here.
            </div>
          </div>
        ) : (
          <div className="are-home__inbox-grid">
            {inbox.slice(0, 4).map((it) => (
              <InboxCard key={it.id} item={it} onActivate={() => jumpInbox(it)} />
            ))}
          </div>
        )}

        {inbox.length > 4 && (
          <div className="are-home__more">
            <Chip tone="muted">
              +{inbox.length - 4} more in Autopilot
            </Chip>
          </div>
        )}
      </section>
    </div>
  );
}
