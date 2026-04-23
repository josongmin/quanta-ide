import { useMemo, useState } from "react";
import { Filter as FilterIcon } from "lucide-react";
import { useAutopilot } from "@quanta/app-autopilot/stores";
import { Chip, SectionHeader, StatDot } from "@quanta/app-autopilot/shared/ui/primitives";
import { RunStatusChip } from "@quanta/app-autopilot/shared/ui/viz";
import type { AutopilotRoute } from "@quanta/app-autopilot/shared/lib";
import { relativeTime } from "@quanta/app-autopilot/shared/lib";
import type { RunStatus } from "@quanta/app-autopilot/entities/run";
import "./runs-page.css";

export interface RunsPageProps {
  navigate: (next: AutopilotRoute, mode?: "push" | "replace") => void;
}

type Filter = "all" | "active" | "abandoned" | "completed";

export function RunsPage({ navigate }: RunsPageProps) {
  const runs = useAutopilot((s) => s.runs);
  const goals = useAutopilot((s) => s.goals);
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(() => {
    const c: Record<Filter | RunStatus, number> = {
      all: runs.length,
      active: 0,
      abandoned: 0,
      completed: 0,
      created: 0,
      running: 0,
      awaiting_review: 0,
      failed: 0,
    } as Record<Filter | RunStatus, number>;
    for (const r of runs) {
      c[r.status] = (c[r.status] ?? 0) + 1;
      if (r.status === "running" || r.status === "awaiting_review") c.active += 1;
      if (r.status === "abandoned") c.abandoned += 1;
      if (r.status === "completed") c.completed += 1;
    }
    return c;
  }, [runs]);

  const filtered = useMemo(() => {
    return runs.filter((r) => {
      if (filter === "all") return true;
      if (filter === "active") return r.status === "running" || r.status === "awaiting_review";
      if (filter === "abandoned") return r.status === "abandoned";
      if (filter === "completed") return r.status === "completed";
      return true;
    });
  }, [runs, filter]);

  return (
    <div className="ap-runs ap-container ap-container--wide">
      <SectionHeader
        eyebrow="Runs"
        title="Execution history"
        subtitle="Plan → patch → validation → metric → proof. Abandons are first-class outcomes."
        trailing={
          <Chip tone="muted" leading={<FilterIcon size={11} strokeWidth={1.8} aria-hidden />} mono>
            snap today
          </Chip>
        }
      />

      <div className="ap-runs__filters" role="tablist" aria-label="Run filter">
        {(["all", "active", "abandoned", "completed"] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filter === f}
            className={filter === f ? "ap-runs__chip is-active" : "ap-runs__chip"}
            onClick={() => setFilter(f)}
          >
            <span>{f}</span>
            <span className="ap-runs__chip-count">{counts[f] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="ap-runs__table">
        <div className="ap-runs__thead">
          <span>status</span>
          <span>operator · branch</span>
          <span>goal</span>
          <span>started</span>
          <span>duration</span>
          <span>proof</span>
        </div>
        <ul className="ap-runs__list">
          {filtered.map((r) => {
            const goal = r.goalId ? goals.find((g) => g.id === r.goalId) : undefined;
            const startedAt = new Date(r.startedAt).getTime();
            const endedAt = r.completedAt ? new Date(r.completedAt).getTime() : Date.now();
            const durationMin = Math.max(1, Math.round((endedAt - startedAt) / 60_000));
            return (
              <li key={r.id}>
                <button
                  type="button"
                  className="ap-runs__row"
                  onClick={() => navigate({ page: "run-detail", id: r.id })}
                >
                  <span className="ap-runs__cell ap-runs__cell--status">
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
                    <RunStatusChip status={r.status} />
                  </span>
                  <span className="ap-runs__cell ap-runs__cell--op">
                    <span className="ap-runs__op">{r.operatorId}</span>
                    <span className="ap-runs__branch">{r.branchName ?? "(no branch)"}</span>
                  </span>
                  <span className="ap-runs__cell ap-runs__cell--goal">
                    {goal != null ? goal.name : <span className="ap-runs__muted">—</span>}
                  </span>
                  <span className="ap-runs__cell ap-runs__cell--time">{relativeTime(r.startedAt)}</span>
                  <span className="ap-runs__cell ap-runs__cell--dur">{durationMin}m</span>
                  <span className="ap-runs__cell ap-runs__cell--proof">
                    {r.proofArtifactId != null ? (
                      <Chip tone="success" mono>proof</Chip>
                    ) : r.status === "abandoned" ? (
                      <Chip tone="warn" mono>abandon</Chip>
                    ) : r.status === "failed" ? (
                      <Chip tone="danger" mono>fail</Chip>
                    ) : (
                      <span className="ap-runs__muted">—</span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
