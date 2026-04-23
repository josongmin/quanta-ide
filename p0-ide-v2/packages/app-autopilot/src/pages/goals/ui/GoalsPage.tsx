import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { useAutopilot } from "@quanta/app-autopilot/stores";
import { Button, Chip, SectionHeader } from "@quanta/app-autopilot/shared/ui/primitives";
import { Gauge, Sparkline } from "@quanta/app-autopilot/shared/ui/viz";
import { evaluateGoal, targetLabel } from "@quanta/app-autopilot/entities/goal";
import { findMetric, formatMetricValue } from "@quanta/app-autopilot/entities/metric";
import type { AutopilotRoute } from "@quanta/app-autopilot/shared/lib";
import "./goals-page.css";

export interface GoalsPageProps {
  navigate: (next: AutopilotRoute, mode?: "push" | "replace") => void;
}

type Filter = "all" | "enforce" | "suggest" | "observe";

export function GoalsPage({ navigate }: GoalsPageProps) {
  const goals = useAutopilot((s) => s.goals);
  const goalStatus = useAutopilot((s) => s.goalStatus);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return goals.filter((g) => {
      if (filter !== "all" && g.mode !== filter) return false;
      if (q && !(`${g.name} ${g.description ?? ""}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [goals, filter, query]);

  return (
    <div className="ap-goals ap-container ap-container--wide">
      <SectionHeader
        eyebrow="Goals"
        title="Desired engineering state"
        subtitle="Goals declare the state the repo should converge to. Planner + operators reconcile; proofs ship with every change."
        trailing={
          <Button
            variant="primary"
            leading={<Plus size={14} strokeWidth={1.8} aria-hidden />}
            kbd="N"
            onClick={() => navigate({ page: "goal-new" })}
          >
            New goal
          </Button>
        }
      />

      <div className="ap-goals__toolbar">
        <div className="ap-goals__search">
          <Search size={14} strokeWidth={1.8} aria-hidden />
          <input
            type="text"
            placeholder="Search goals…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search goals"
          />
        </div>
        <div className="ap-seg" role="tablist" aria-label="Goal mode filter">
          {(["all", "enforce", "suggest", "observe"] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              className={filter === f ? "ap-seg__btn is-active" : "ap-seg__btn"}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <ul className="ap-goals__list">
        {filtered.length === 0 && (
          <div className="ap-empty">
            <div className="ap-empty__title">No goals match.</div>
            <div className="ap-empty__sub">Try a different filter or search term.</div>
          </div>
        )}
        {filtered.map((g) => {
          const status = goalStatus.find((s) => s.goalId === g.id);
          if (!status) return null;
          return (
            <li key={g.id}>
              <button
                type="button"
                className="ap-goals__row"
                onClick={() => navigate({ page: "goal-detail", id: g.id })}
              >
                <div className="ap-goals__row-left">
                  <div className="ap-goals__row-title">{g.name}</div>
                  <div className="ap-goals__row-sub">{g.description}</div>
                  <div className="ap-goals__row-meta">
                    <Chip tone={g.mode === "enforce" ? "accent" : g.mode === "suggest" ? "muted" : "neutral"}>
                      {g.mode}
                    </Chip>
                    <Chip tone="muted">
                      {g.scope.repo ? "repo" : `${g.scope.paths?.length ?? 0} paths`}
                    </Chip>
                    <Chip tone="muted" mono>{g.autonomyProfile}</Chip>
                    <span className="ap-goals__row-runs">
                      {status.activeWorkItemCount} in flight · {status.completedRunsLast7d} done (7d)
                      {status.abandonedRunsLast7d > 0 && ` · ${status.abandonedRunsLast7d} abandoned`}
                    </span>
                  </div>
                </div>
                <div className="ap-goals__row-right">
                  {g.targets.slice(0, 2).map((t, i) => {
                    const ts = status.targets.find((x) => x.metric === t.metric);
                    if (!ts) return null;
                    const baseline = ts.current - ts.deltaFromBaseline;
                    const { progress, satisfied } = evaluateGoal(ts.current, baseline, t);
                    const def = findMetric(t.metric);
                    return (
                      <div key={i} className="ap-goals__target">
                        <div className="ap-goals__target-head">
                          <span className="ap-goals__target-name">{def?.name ?? t.metric}</span>
                          <span className="ap-goals__target-rule">
                            {targetLabel(t.operator)} {formatMetricValue(Number(t.value), def?.unit ?? "count")}
                          </span>
                        </div>
                        <Gauge
                          progress={progress}
                          tone={satisfied ? "good" : progress > 0.5 ? "neutral" : "warn"}
                          variant="bar"
                        />
                        <div className="ap-goals__target-numbers">
                          <span className="ap-mono">{formatMetricValue(ts.current, def?.unit ?? "count")}</span>
                          <Sparkline
                            values={ts.history ?? []}
                            tone={satisfied ? "good" : "neutral"}
                            target={Number(t.value)}
                            width={96}
                            height={20}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
