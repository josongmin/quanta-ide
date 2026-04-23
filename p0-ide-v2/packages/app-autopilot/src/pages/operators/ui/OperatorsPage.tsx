import { ArrowUpRight } from "lucide-react";
import { tabBus, type TabApp } from "@quanta/shell/stores/tab-bus";
import { useAutopilot } from "@quanta/app-autopilot/stores";
import { Chip, SectionHeader, StatDot } from "@quanta/app-autopilot/shared/ui/primitives";
import type { AutopilotRoute } from "@quanta/app-autopilot/shared/lib";
import "./operators-page.css";

export interface OperatorsPageProps {
  navigate: (next: AutopilotRoute, mode?: "push" | "replace") => void;
}

export function OperatorsPage({ navigate }: OperatorsPageProps) {
  const operators = useAutopilot((s) => s.operators);

  return (
    <div className="ap-ops ap-container">
      <SectionHeader
        eyebrow="Operators"
        title="Execution specialists"
        subtitle="Each operator owns one narrow task class. v0 ships rule_repair only; the rest are Phase 2+. Select an operator to inspect candidates and acceptance history."
      />

      <ul className="ap-ops__list">
        {operators.map((op) => {
          const clickable = op.status === "ready";
          return (
            <li key={op.id}>
              <article
                className={`ap-ops__card ap-ops__card--${op.status} ${clickable ? "is-clickable" : ""}`}
                onClick={clickable ? () => navigate({ page: "operator-detail", id: op.id }) : undefined}
                onKeyDown={(e) => {
                  if (!clickable) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate({ page: "operator-detail", id: op.id });
                  }
                }}
                tabIndex={clickable ? 0 : -1}
                role={clickable ? "button" : undefined}
              >
                <header className="ap-ops__head">
                  <span className="ap-ops__title">{op.displayName}</span>
                  <Chip tone={op.status === "ready" ? "success" : op.status === "phase-2" ? "muted" : "warn"}>
                    <StatDot tone={op.status === "ready" ? "success" : "muted"} />
                    <span style={{ marginLeft: 4 }}>{op.status}</span>
                  </Chip>
                </header>
                <p className="ap-ops__tag">{op.tagline}</p>

                <dl className="ap-ops__kv">
                  <dt>operations</dt>
                  <dd>
                    <div className="ap-ops__ops">
                      {op.supportedOperations.length === 0 ? (
                        <span className="ap-ops__muted">—</span>
                      ) : (
                        op.supportedOperations.map((a) => (
                          <Chip key={a} tone="muted" mono>{a}</Chip>
                        ))
                      )}
                    </div>
                  </dd>

                  <dt>risk tiers</dt>
                  <dd>
                    <div className="ap-ops__risks">
                      {op.supportedRiskTiers.map((r) => (
                        <Chip
                          key={r}
                          tone={r === "low" ? "success" : r === "medium" ? "muted" : "warn"}
                        >
                          {r}
                        </Chip>
                      ))}
                    </div>
                  </dd>

                  <dt>acceptance</dt>
                  <dd>
                    {op.acceptanceRate != null ? (
                      <span className="ap-ops__mono">{(op.acceptanceRate * 100).toFixed(0)}%</span>
                    ) : (
                      <span className="ap-ops__muted">no history</span>
                    )}
                  </dd>
                  <dt>recent (7d)</dt>
                  <dd>
                    <span className="ap-ops__mono">
                      {op.recentCandidateCount ?? 0} candidates
                      {op.recentAbandonCount != null && op.recentAbandonCount > 0 && (
                        <> · {op.recentAbandonCount} abandoned</>
                      )}
                    </span>
                  </dd>
                </dl>

                {clickable && (
                  <footer className="ap-ops__foot">
                    <button
                      type="button"
                      className="ap-linklike"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate({ page: "operator-detail", id: op.id });
                      }}
                    >
                      Inspect operator <ArrowUpRight size={12} strokeWidth={2} aria-hidden />
                    </button>
                    <button
                      type="button"
                      className="ap-linklike"
                      onClick={(e) => {
                        e.stopPropagation();
                        tabBus.open("rules" as TabApp, "Rules");
                      }}
                    >
                      Rules app →
                    </button>
                  </footer>
                )}
              </article>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
