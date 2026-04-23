import { useAutopilot } from "@quanta/app-autopilot/stores";
import { Chip, SectionHeader, StatDot } from "@quanta/app-autopilot/shared/ui/primitives";
import type { AutopilotRoute } from "@quanta/app-autopilot/shared/lib";
import { relativeTime } from "@quanta/app-autopilot/shared/lib";
import type { WorkItemStatus } from "@quanta/app-autopilot/entities/work-item";
import "./workitems-page.css";

export interface WorkItemsPageProps {
  navigate: (next: AutopilotRoute, mode?: "push" | "replace") => void;
}

const STATUS_TONE: Record<WorkItemStatus, "accent" | "success" | "warn" | "danger" | "muted" | "neutral"> = {
  queued: "muted",
  planned: "muted",
  running: "accent",
  awaiting_review: "accent",
  blocked: "warn",
  completed: "success",
  abandoned: "warn",
};

export function WorkItemsPage({ navigate }: WorkItemsPageProps) {
  const workItems = useAutopilot((s) => s.workItems);
  const goals = useAutopilot((s) => s.goals);

  return (
    <div className="ap-wi ap-container ap-container--wide">
      <SectionHeader
        eyebrow="Work items"
        title="Structured planner contracts"
        subtitle="What operator + actions + constraints + proof requirements the planner dispatched. Clicking opens the most recent run."
      />

      <div className="ap-wi__table">
        <div className="ap-wi__thead">
          <span>status</span>
          <span>title</span>
          <span>operator</span>
          <span>class</span>
          <span>risk</span>
          <span>goal</span>
          <span>updated</span>
        </div>
        <ul className="ap-wi__list">
          {workItems.map((w) => {
            const goal = w.relatedGoals[0] ? goals.find((g) => g.id === w.relatedGoals[0]) : undefined;
            return (
              <li key={w.id}>
                <button
                  type="button"
                  className="ap-wi__row"
                  onClick={() => {
                    if (goal) navigate({ page: "goal-detail", id: goal.id });
                  }}
                >
                  <span className="ap-wi__cell ap-wi__cell--status">
                    <StatDot tone={STATUS_TONE[w.status]} pulse={w.status === "running"} />
                    <span className="ap-wi__status-label">{w.status.replace("_", " ")}</span>
                  </span>
                  <span className="ap-wi__cell ap-wi__cell--title">
                    <span className="ap-wi__title">{w.title}</span>
                    <span className="ap-wi__desc">{w.description}</span>
                  </span>
                  <span className="ap-wi__cell">
                    <Chip tone="muted" mono>{w.operatorId}</Chip>
                  </span>
                  <span className="ap-wi__cell ap-wi__cell--class">
                    {w.taskClass.replace(/_/g, " ")}
                  </span>
                  <span className="ap-wi__cell">
                    <Chip
                      tone={w.riskTier === "low" ? "success" : w.riskTier === "medium" ? "muted" : "warn"}
                    >
                      {w.riskTier}
                    </Chip>
                  </span>
                  <span className="ap-wi__cell ap-wi__cell--goal">
                    {goal != null ? goal.name : <span className="ap-wi__muted">—</span>}
                  </span>
                  <span className="ap-wi__cell ap-wi__cell--time">{relativeTime(w.updatedAt)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
