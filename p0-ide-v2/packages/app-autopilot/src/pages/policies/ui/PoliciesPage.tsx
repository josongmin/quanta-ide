import { FileLock2, ShieldCheck } from "lucide-react";
import { useAutopilot } from "@quanta/app-autopilot/stores";
import { Chip, SectionHeader } from "@quanta/app-autopilot/shared/ui/primitives";
import type { AutopilotRoute } from "@quanta/app-autopilot/shared/lib";
import { relativeTime } from "@quanta/app-autopilot/shared/lib";
import "./policies-page.css";

export interface PoliciesPageProps {
  navigate: (next: AutopilotRoute, mode?: "push" | "replace") => void;
}

export function PoliciesPage({ navigate }: PoliciesPageProps) {
  const policies = useAutopilot((s) => s.policies);
  const goals = useAutopilot((s) => s.goals);

  return (
    <div className="ap-pols ap-container">
      <SectionHeader
        eyebrow="Policies"
        title="What autopilot may never do"
        subtitle="Policies constrain every run — allowed operators, forbidden operations, protected zones, approval rules. Canonical source is repo-stored yaml (Phase 2)."
        trailing={
          <Chip tone="success" leading={<ShieldCheck size={11} strokeWidth={2} aria-hidden />}>
            Policy-as-Code
          </Chip>
        }
      />

      <ul className="ap-pols__list">
        {policies.map((p) => {
          const scope = p.scope.repo
            ? "repo-wide"
            : `${p.scope.paths?.length ?? 0} path${p.scope.paths?.length === 1 ? "" : "s"}`;
          const appliedGoals = goals.filter((g) =>
            g.scope.repo || p.scope.repo ||
            (g.scope.paths ?? []).some((gp) => (p.scope.paths ?? []).some((pp) => gp.startsWith(pp.replace("/**", "")))),
          );
          return (
            <li key={p.id}>
              <button
                type="button"
                className="ap-pols__row"
                onClick={() => navigate({ page: "policy-detail", id: p.id })}
              >
                <div className="ap-pols__row-left">
                  <div className="ap-pols__row-head">
                    <FileLock2 size={14} strokeWidth={1.8} aria-hidden />
                    <span className="ap-pols__row-title">{p.name}</span>
                  </div>
                  <code className="ap-mono ap-pols__row-id">{p.id}</code>
                  <div className="ap-pols__row-meta">
                    <Chip tone="muted">{scope}</Chip>
                    <Chip tone="muted">max risk · {p.riskPolicy.maxRisk}</Chip>
                    <Chip tone="muted">
                      {p.protectedZones.length} protected zone{p.protectedZones.length === 1 ? "" : "s"}
                    </Chip>
                    <Chip tone="muted">
                      {appliedGoals.length} applied goal{appliedGoals.length === 1 ? "" : "s"}
                    </Chip>
                    <span className="ap-pols__when">updated {relativeTime(p.updatedAt)}</span>
                  </div>
                </div>
                <div className="ap-pols__row-right">
                  <div className="ap-pols__row-ops">
                    <div className="ap-pols__row-ops-lbl">allowed ops</div>
                    <div className="ap-pols__row-ops-body">
                      {p.allowedOperations.slice(0, 4).map((o) => (
                        <Chip key={o} tone="success" mono>{o}</Chip>
                      ))}
                      {p.allowedOperations.length > 4 && (
                        <Chip tone="muted">+{p.allowedOperations.length - 4}</Chip>
                      )}
                    </div>
                  </div>
                  {p.forbiddenOperations.length > 0 && (
                    <div className="ap-pols__row-ops">
                      <div className="ap-pols__row-ops-lbl">forbidden</div>
                      <div className="ap-pols__row-ops-body">
                        {p.forbiddenOperations.slice(0, 3).map((o) => (
                          <Chip key={o} tone="danger" mono>{o}</Chip>
                        ))}
                        {p.forbiddenOperations.length > 3 && (
                          <Chip tone="muted">+{p.forbiddenOperations.length - 3}</Chip>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
