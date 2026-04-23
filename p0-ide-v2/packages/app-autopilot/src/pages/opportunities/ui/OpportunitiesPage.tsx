import { Sparkles } from "lucide-react";
import { useAutopilot } from "@quanta/app-autopilot/stores";
import { Chip, SectionHeader } from "@quanta/app-autopilot/shared/ui/primitives";
import type { AutopilotRoute } from "@quanta/app-autopilot/shared/lib";
import { relativeTime } from "@quanta/app-autopilot/shared/lib";
import type { OpportunityKind } from "@quanta/app-autopilot/entities/opportunity";
import "./opportunities-page.css";

export interface OpportunitiesPageProps {
  navigate: (next: AutopilotRoute, mode?: "push" | "replace") => void;
}

const KIND_LABEL: Record<OpportunityKind, string> = {
  layer_violation: "layer violation",
  import_boundary: "import boundary",
  dead_code: "dead code",
  flaky_test: "flaky test",
  deprecated_api: "deprecated API",
  missing_test: "missing test",
  mechanical_migration: "mechanical migration",
  dependency_cycle: "dep cycle",
  god_class: "god class",
};

export function OpportunitiesPage({ navigate: _navigate }: OpportunitiesPageProps) {
  const opportunities = useAutopilot((s) => s.opportunities);

  const sorted = [...opportunities].sort((a, b) => b.score - a.score);

  return (
    <div className="ap-opp ap-container ap-container--wide">
      <SectionHeader
        eyebrow="Opportunities"
        title="What autopilot found on its own"
        subtitle="Opportunities are work the system surfaced without a matching goal. Queue them or let them drive new goals."
        trailing={
          <Chip tone="accent" leading={<Sparkles size={11} strokeWidth={2} aria-hidden />}>
            {opportunities.length} open
          </Chip>
        }
      />

      <div className="ap-opp__grid">
        {sorted.map((o) => (
          <article key={o.id} className="ap-opp__card">
            <header className="ap-opp__head">
              <span className="ap-opp__kind">{KIND_LABEL[o.kind]}</span>
              <span className="ap-opp__score" aria-label={`score ${o.score}`}>
                <svg width="42" height="42" viewBox="0 0 42 42" aria-hidden>
                  <circle
                    cx="21"
                    cy="21"
                    r="18"
                    fill="none"
                    stroke="var(--bg-muted)"
                    strokeWidth="4"
                  />
                  <circle
                    cx="21"
                    cy="21"
                    r="18"
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth="4"
                    strokeDasharray={`${(o.score / 100) * 113} 113`}
                    strokeLinecap="round"
                    transform="rotate(-90 21 21)"
                    style={{ transition: "stroke-dasharray 400ms ease" }}
                  />
                </svg>
                <span className="ap-opp__score-num">{o.score}</span>
              </span>
            </header>
            <h3 className="ap-opp__title">{o.title}</h3>
            <p className="ap-opp__summary">{o.summary}</p>
            <div className="ap-opp__paths">
              {o.paths.map((p) => (
                <code key={p} className="ap-mono ap-opp__path">{p}</code>
              ))}
            </div>
            <footer className="ap-opp__foot">
              <Chip tone="muted" mono>{o.suggestedOperator}</Chip>
              <span className="ap-opp__age">{relativeTime(o.createdAt)}</span>
            </footer>
          </article>
        ))}
      </div>
    </div>
  );
}
