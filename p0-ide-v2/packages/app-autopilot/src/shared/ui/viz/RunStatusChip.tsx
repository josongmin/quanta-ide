import { Chip } from "@quanta/app-autopilot/shared/ui/primitives";
import type { RunStatus } from "@quanta/app-autopilot/entities/run";

const STATUS_META: Record<
  RunStatus,
  { label: string; tone: "accent" | "success" | "warn" | "danger" | "muted" | "neutral" }
> = {
  created: { label: "Created", tone: "muted" },
  running: { label: "Running", tone: "accent" },
  awaiting_review: { label: "Awaiting review", tone: "accent" },
  completed: { label: "Completed", tone: "success" },
  abandoned: { label: "Abandoned", tone: "warn" },
  failed: { label: "Failed", tone: "danger" },
};

export function RunStatusChip({ status }: { status: RunStatus }) {
  const meta = STATUS_META[status];
  return (
    <Chip tone={meta.tone} leading={<span className="ap-run-status-dot" data-tone={meta.tone} />}>
      {meta.label}
    </Chip>
  );
}
