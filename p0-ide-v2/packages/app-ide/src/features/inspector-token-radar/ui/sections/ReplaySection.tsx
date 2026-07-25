import { useMemo, useState } from "react";
import type { AgentRun, ReplayKind } from "@quanta/app-ide/entities/token-radar";
import { fmtUsd, ROLE_LABEL, SectionTitle } from "./helpers";

const KIND_LABEL: Record<ReplayKind, string> = {
  plan:     "plan",
  edit:     "edit",
  test:     "test",
  review:   "review",
  rollback: "rollback",
  alert:    "alert",
  tool:     "tool",
  compact:  "compact",
  human:    "human",
};

const KIND_TONE: Record<ReplayKind, string> = {
  plan:     "tr-pane__rep-dot--plan",
  edit:     "tr-pane__rep-dot--edit",
  test:     "tr-pane__rep-dot--test",
  review:   "tr-pane__rep-dot--review",
  rollback: "tr-pane__rep-dot--rollback",
  alert:    "tr-pane__rep-dot--alert",
  tool:     "tr-pane__rep-dot--tool",
  compact:  "tr-pane__rep-dot--compact",
  human:    "tr-pane__rep-dot--human",
};

const FILTER_KINDS: ReplayKind[] = ["plan", "edit", "test", "review", "tool", "alert", "compact", "rollback", "human"];

/**
 * Token Replay timeline — rewatch the run minute-by-minute.
 * Filters by kind; rows that touch the focused file have a side rail.
 */
export function ReplaySection({ run }: { run: AgentRun }) {
  const [active, setActive] = useState<Set<ReplayKind>>(new Set(FILTER_KINDS));

  const events = useMemo(
    () => run.replay.filter((e) => active.has(e.kind)),
    [run.replay, active],
  );

  const totalCost = useMemo(
    () => run.replay.reduce((a, e) => a + (e.costUsd ?? 0), 0),
    [run.replay],
  );

  return (
    <div className="tr-pane__section">
      <SectionTitle
        tier="t2"
        title="Token Replay timeline"
        hint="rewatch the run; rows touching the focused file are highlighted"
        badge={fmtUsd(totalCost)}
      />

      <div className="tr-pane__rep-filters" role="toolbar" aria-label="Filter events">
        {FILTER_KINDS.map((k) => {
          const on = active.has(k);
          return (
            <button
              key={k}
              type="button"
              className={`tr-pane__rep-filter${on ? " is-active" : ""}`}
              aria-pressed={on}
              onClick={() => {
                const next = new Set(active);
                if (on) {
                  next.delete(k);
                } else {
                  next.add(k);
                }
                setActive(next);
              }}
            >
              <span className={`tr-pane__rep-dot ${KIND_TONE[k]}`} />
              {KIND_LABEL[k]}
            </button>
          );
        })}
      </div>

      <ol className="tr-pane__rep-timeline">
        {events.length === 0 ? (
          <li className="tr-pane__empty-row">no events match these filters</li>
        ) : (
          events.map((e, i) => (
            <li
              key={i}
              className={`tr-pane__rep-row${e.touchesFocusedFile ? " is-focused" : ""}${e.kind === "alert" ? " is-alert" : ""}`}
            >
              <span className="tr-pane__rep-time tr-pane__mono">{e.at}</span>
              <span className={`tr-pane__rep-dot tr-pane__rep-dot--lg ${KIND_TONE[e.kind]}`} />
              <span className="tr-pane__chip">{KIND_LABEL[e.kind]}</span>
              <span className="tr-pane__chip tr-pane__chip--role">
                {e.actor === "system" ? "system" : e.actor === "human" ? "human" : ROLE_LABEL[e.actor]}
              </span>
              <span className="tr-pane__rep-label">{e.label}</span>
              {typeof e.costUsd === "number" && e.costUsd > 0 && (
                <span className="tr-pane__rep-cost tr-pane__mono">{fmtUsd(e.costUsd)}</span>
              )}
              {e.detail && <span className="tr-pane__rep-detail">{e.detail}</span>}
            </li>
          ))
        )}
      </ol>
    </div>
  );
}
