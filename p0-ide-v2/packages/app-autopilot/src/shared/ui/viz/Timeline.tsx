import type { ReactNode } from "react";
import {
  Check,
  CircleDashed,
  FileSearch,
  FlaskConical,
  GitCommit,
  Loader2,
  OctagonX,
  UserCheck,
  X,
  Zap,
} from "lucide-react";
import { cn } from "@quanta/ui-kit/lib";
import type { RunStep, RunStepKind, RunStepStatus } from "@quanta/app-autopilot/entities/run";
import { relativeTime } from "@quanta/app-autopilot/shared/lib";
import "./timeline.css";

const STEP_ICON: Record<RunStepKind, ReactNode> = {
  plan: <FileSearch size={14} strokeWidth={1.8} aria-hidden />,
  patch: <GitCommit size={14} strokeWidth={1.8} aria-hidden />,
  validation: <FlaskConical size={14} strokeWidth={1.8} aria-hidden />,
  metric: <Zap size={14} strokeWidth={1.8} aria-hidden />,
  review: <UserCheck size={14} strokeWidth={1.8} aria-hidden />,
  abort: <OctagonX size={14} strokeWidth={1.8} aria-hidden />,
};

const STATUS_ICON: Record<RunStepStatus, ReactNode> = {
  "in-progress": <Loader2 className="ap-timeline__spin" size={12} strokeWidth={2} aria-hidden />,
  passed: <Check size={12} strokeWidth={2.4} aria-hidden />,
  failed: <X size={12} strokeWidth={2.4} aria-hidden />,
  pending: <CircleDashed size={12} strokeWidth={1.8} aria-hidden />,
  skipped: <CircleDashed size={12} strokeWidth={1.8} aria-hidden />,
};

export interface TimelineProps {
  steps: readonly RunStep[];
  className?: string;
}

export function Timeline({ steps, className }: TimelineProps) {
  return (
    <ol className={cn("ap-timeline", className)}>
      {steps.map((step, i) => {
        const isLast = i === steps.length - 1;
        const tone = stepTone(step);
        return (
          <li key={step.id} className={cn("ap-timeline__row", `ap-timeline__row--${tone}`)}>
            <div className="ap-timeline__gutter">
              <span
                className={cn(
                  "ap-timeline__node",
                  step.status === "in-progress" && "ap-timeline__node--pulse",
                )}
              >
                {STEP_ICON[step.kind]}
              </span>
              {!isLast && <span className="ap-timeline__rail" />}
            </div>
            <div className="ap-timeline__body">
              <div className="ap-timeline__head">
                <span className="ap-timeline__kind">{step.kind}</span>
                <span className={cn("ap-timeline__status", `ap-timeline__status--${step.status}`)}>
                  {STATUS_ICON[step.status]}
                </span>
                <span className="ap-timeline__time">{relativeTime(step.at)}</span>
              </div>
              <div className="ap-timeline__title">{step.title}</div>
              {step.detail != null && <div className="ap-timeline__detail">{step.detail}</div>}
              {step.tokens != null && (
                <div className="ap-timeline__meta">
                  <span>{step.tokens.toLocaleString()} tokens</span>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function stepTone(step: RunStep): "ok" | "fail" | "run" | "wait" | "abort" {
  if (step.kind === "abort") return "abort";
  if (step.status === "failed") return "fail";
  if (step.status === "in-progress") return "run";
  if (step.status === "pending") return "wait";
  return "ok";
}
