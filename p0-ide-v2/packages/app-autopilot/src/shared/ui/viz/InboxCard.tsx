import type { ReactNode } from "react";
import {
  AlertTriangle,
  BellDot,
  CircleArrowRight,
  CircleSlash,
  Gauge,
  Lightbulb,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { cn } from "@quanta/ui-kit/lib";
import type { InboxItem, InboxItemKind, InboxUrgency } from "@quanta/app-autopilot/entities/inbox";
import { relativeTime } from "@quanta/app-autopilot/shared/lib";
import "./inbox-card.css";

const KIND_ICON: Record<InboxItemKind, ReactNode> = {
  review_needed: <UserCheck size={14} strokeWidth={1.8} aria-hidden />,
  auto_run_scheduled: <CircleArrowRight size={14} strokeWidth={1.8} aria-hidden />,
  abandoned: <CircleSlash size={14} strokeWidth={1.8} aria-hidden />,
  drift_spike: <AlertTriangle size={14} strokeWidth={1.8} aria-hidden />,
  new_opportunity: <Lightbulb size={14} strokeWidth={1.8} aria-hidden />,
  goal_satisfied: <Sparkles size={14} strokeWidth={1.8} aria-hidden />,
  guarded_lane_promotion: <BellDot size={14} strokeWidth={1.8} aria-hidden />,
};

const KIND_LABEL: Record<InboxItemKind, string> = {
  review_needed: "Review needed",
  auto_run_scheduled: "Auto-running",
  abandoned: "Abandoned",
  drift_spike: "Drift spike",
  new_opportunity: "New opportunity",
  goal_satisfied: "Goal satisfied",
  guarded_lane_promotion: "Promotion pending",
};

const URGENCY_META: Record<InboxUrgency, { label: string; tone: "danger" | "warn" | "muted" }> = {
  now: { label: "Now", tone: "danger" },
  today: { label: "Today", tone: "warn" },
  watch: { label: "Watch", tone: "muted" },
};

export interface InboxCardProps {
  item: InboxItem;
  active?: boolean;
  onActivate?: () => void;
  onDismiss?: () => void;
}

export function InboxCard({ item, active, onActivate, onDismiss }: InboxCardProps) {
  const urgency = URGENCY_META[item.urgency];
  return (
    <article
      className={cn("ap-inbox-card", `ap-inbox-card--${item.kind}`, active && "is-active")}
      role="button"
      tabIndex={0}
      onClick={onActivate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onActivate?.();
        }
        if (e.key === "x" || e.key === "X") {
          e.preventDefault();
          onDismiss?.();
        }
      }}
    >
      <header className="ap-inbox-card__head">
        <span className="ap-inbox-card__kind">
          <span className="ap-inbox-card__kind-icon">{KIND_ICON[item.kind]}</span>
          <span>{KIND_LABEL[item.kind]}</span>
        </span>
        <span className={cn("ap-inbox-card__urgency", `ap-inbox-card__urgency--${urgency.tone}`)}>
          <Gauge size={10} strokeWidth={2.2} aria-hidden />
          {urgency.label}
        </span>
        <span className="ap-inbox-card__time">{relativeTime(item.createdAt)}</span>
      </header>
      <dl className="ap-inbox-card__slots">
        <div className="ap-inbox-card__slot">
          <dt>what</dt>
          <dd>{item.happened}</dd>
        </div>
        <div className="ap-inbox-card__slot">
          <dt>who decided</dt>
          <dd>{item.decidedBy}</dd>
        </div>
        <div className="ap-inbox-card__slot">
          <dt>next</dt>
          <dd className="ap-inbox-card__next">{item.nextAction}</dd>
        </div>
      </dl>
    </article>
  );
}
