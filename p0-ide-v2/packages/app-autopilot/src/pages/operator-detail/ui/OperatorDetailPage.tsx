import { useMemo } from "react";
import { Factory, GitCommit, Wrench } from "lucide-react";
import { useAutopilot, selectors } from "@quanta/app-autopilot/stores";
import { Chip, Kbd, SectionHeader, StatDot } from "@quanta/app-autopilot/shared/ui/primitives";
import { RadialGauge, Sparkline } from "@quanta/app-autopilot/shared/ui/viz";
import type { AutopilotRoute } from "@quanta/app-autopilot/shared/lib";
import { relativeTime } from "@quanta/app-autopilot/shared/lib";
import "./operator-detail-page.css";

export interface OperatorDetailPageProps {
  operatorId: string;
  navigate: (next: AutopilotRoute, mode?: "push" | "replace") => void;
}

const ACCEPTANCE_HISTORY: Record<string, number[]> = {
  rule_repair: [0.82, 0.84, 0.86, 0.88, 0.89, 0.91, 0.92, 0.93, 0.94, 0.94],
};

export function OperatorDetailPage({ operatorId, navigate }: OperatorDetailPageProps) {
  const op = useAutopilot(selectors.operatorById(operatorId));
  const allRuns = useAutopilot((s) => s.runs);
  const allWorkItems = useAutopilot((s) => s.workItems);
  const allOpportunities = useAutopilot((s) => s.opportunities);
  const runs = useMemo(
    () => allRuns.filter((r) => r.operatorId === operatorId),
    [allRuns, operatorId],
  );
  const workItems = useMemo(
    () => allWorkItems.filter((w) => w.operatorId === operatorId),
    [allWorkItems, operatorId],
  );
  const opportunities = useMemo(
    () => allOpportunities.filter((o) => o.suggestedOperator === operatorId),
    [allOpportunities, operatorId],
  );

  if (!op) {
    return (
      <div className="ap-empty">
        <div className="ap-empty__title">Operator not found.</div>
        <button type="button" className="ap-linklike" onClick={() => navigate({ page: "operators" })}>
          Back to operators
        </button>
      </div>
    );
  }

  const history = ACCEPTANCE_HISTORY[op.id] ?? [0.7, 0.72, 0.74, 0.75, 0.76, 0.77];
  const successfulRuns = runs.filter((r) => r.status === "completed").length;
  const abandonedRuns = runs.filter((r) => r.status === "abandoned").length;
  const runningRuns = runs.filter((r) => r.status === "running" || r.status === "awaiting_review").length;

  return (
    <div className="ap-opdt ap-container">
      <header className="ap-detail-head">
        <div className="ap-detail-head__text">
          <div className="ap-opdt__eyebrow">
            <Factory size={12} strokeWidth={2} aria-hidden />
            <span>OPERATOR · {op.status}</span>
          </div>
          <h1 className="ap-detail-head__title">{op.displayName}</h1>
          <p className="ap-detail-head__sub">{op.tagline}</p>
          <div className="ap-opdt__meta">
            <Chip tone={op.status === "ready" ? "success" : "muted"}>
              <StatDot tone={op.status === "ready" ? "success" : "muted"} pulse={op.status === "ready"} />
              <span style={{ marginLeft: 4 }}>{op.status}</span>
            </Chip>
            {op.supportedRiskTiers.map((r) => (
              <Chip key={r} tone={r === "low" ? "success" : r === "medium" ? "muted" : "warn"}>
                risk · {r}
              </Chip>
            ))}
          </div>
        </div>

        <div className="ap-opdt__gauge">
          {op.acceptanceRate != null ? (
            <RadialGauge
              progress={op.acceptanceRate}
              size={124}
              stroke={12}
              tone={op.acceptanceRate > 0.9 ? "good" : op.acceptanceRate > 0.7 ? "accent" : "warn"}
            >
              <span className="ap-opdt__gauge-num">{Math.round(op.acceptanceRate * 100)}%</span>
              <span className="ap-opdt__gauge-label">accept</span>
            </RadialGauge>
          ) : (
            <div className="ap-opdt__gauge-empty">
              <Wrench size={28} strokeWidth={1.5} aria-hidden />
              <span>phase-2</span>
            </div>
          )}
        </div>
      </header>

      <section className="ap-opdt__stats">
        <StatBlock label="Supported ops" value={op.supportedOperations.length.toString()} />
        <StatBlock label="Running / in review" value={runningRuns.toString()} />
        <StatBlock label="Completed (all-time)" value={successfulRuns.toString()} />
        <StatBlock label="Abandoned (all-time)" value={abandonedRuns.toString()} tone={abandonedRuns > 0 ? "warn" : "neutral"} />
      </section>

      <section className="ap-opdt__history">
        <SectionHeader
          eyebrow="Acceptance history"
          title="Reviewer trust over time"
          subtitle="Share of operator PRs accepted without changes. Used to determine auto-merge eligibility under the safe-production profile."
        />
        <div className="ap-opdt__hist-chart">
          <Sparkline
            values={history}
            tone="good"
            target={0.95}
            baseline={history[0]!}
            width={720}
            height={96}
          />
          <div className="ap-opdt__hist-axis">
            <span>10w ago</span>
            <span>now</span>
          </div>
        </div>
      </section>

      <section>
        <SectionHeader
          eyebrow="Supported operations"
          title={`${op.supportedOperations.length} mechanical actions`}
          subtitle="Each operation has a deterministic validator."
        />
        {op.supportedOperations.length > 0 ? (
          <div className="ap-opdt__ops-grid">
            {op.supportedOperations.map((o) => (
              <div key={o} className="ap-opdt__op">
                <Wrench size={12} strokeWidth={1.8} aria-hidden />
                <span className="ap-mono">{o}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="ap-empty">
            <div className="ap-empty__title">Phase-2 operator</div>
            <div className="ap-empty__sub">
              Operations will be defined when this operator is wired up in the planner.
            </div>
          </div>
        )}
      </section>

      <div className="ap-opdt__split">
        <section>
          <SectionHeader
            eyebrow="Candidates"
            title={`${opportunities.length} opportunity-driven`}
            subtitle="Work the operator has surfaced on its own, awaiting goal match."
          />
          <ul className="ap-opdt__cands">
            {opportunities.length === 0 ? (
              <li className="ap-opdt__empty-inline">No active candidates.</li>
            ) : (
              opportunities.map((o) => (
                <li key={o.id}>
                  <div className="ap-opdt__cand">
                    <div className="ap-opdt__cand-score">{o.score}</div>
                    <div className="ap-opdt__cand-body">
                      <div className="ap-opdt__cand-title">{o.title}</div>
                      <code className="ap-mono ap-opdt__cand-path">{o.paths[0]}</code>
                    </div>
                  </div>
                </li>
              ))
            )}
          </ul>
        </section>

        <section>
          <SectionHeader
            eyebrow="Recent runs"
            title={`${runs.length} total`}
            subtitle="Click to open the run timeline."
          />
          <ul className="ap-opdt__runs">
            {runs.slice(0, 6).map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className="ap-opdt__run"
                  onClick={() => navigate({ page: "run-detail", id: r.id })}
                >
                  <StatDot
                    tone={
                      r.status === "completed" ? "success"
                      : r.status === "running" ? "accent"
                      : r.status === "abandoned" ? "warn"
                      : r.status === "failed" ? "danger"
                      : "muted"
                    }
                    pulse={r.status === "running"}
                  />
                  <GitCommit size={11} strokeWidth={1.8} aria-hidden />
                  <span className="ap-opdt__run-branch">{r.branchName ?? r.id}</span>
                  <span className="ap-opdt__run-status">{r.status.replace("_", " ")}</span>
                  <span className="ap-opdt__run-time">{relativeTime(r.startedAt)}</span>
                </button>
              </li>
            ))}
            {runs.length === 0 && <li className="ap-opdt__empty-inline">No runs yet.</li>}
          </ul>
        </section>
      </div>

      <section>
        <SectionHeader
          eyebrow="Work items"
          title={`${workItems.length} dispatched`}
          subtitle="Across all related goals."
        />
        {workItems.length === 0 ? (
          <div className="ap-opdt__empty-inline">None.</div>
        ) : (
          <ul className="ap-opdt__wi">
            {workItems.slice(0, 8).map((w) => (
              <li key={w.id}>
                <StatDot tone={w.status === "completed" ? "success" : w.status === "abandoned" ? "warn" : "accent"} />
                <span className="ap-opdt__wi-title">{w.title}</span>
                <Chip tone="muted">{w.status.replace("_", " ")}</Chip>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="ap-opdt__hint">
        <Kbd>Esc</Kbd>
        <span>back to operators</span>
      </div>
    </div>
  );
}

function StatBlock({ label, value, tone }: { label: string; value: string; tone?: "warn" | "neutral" }) {
  return (
    <div className={`ap-opdt__stat ${tone === "warn" ? "is-warn" : ""}`}>
      <div className="ap-opdt__stat-label">{label}</div>
      <div className="ap-opdt__stat-value">{value}</div>
    </div>
  );
}
