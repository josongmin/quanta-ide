import { ChevronRight } from "lucide-react";
import { useAutopilot, selectors } from "@quanta/app-autopilot/stores";
import type { AutopilotRoute } from "@quanta/app-autopilot/shared/lib";

export interface TopLineProps {
  route: AutopilotRoute;
  onNavigate: (next: AutopilotRoute) => void;
}

export function TopLine({ route, onNavigate }: TopLineProps) {
  const goal = useAutopilot((s) =>
    route.page === "goal-detail"
      ? selectors.goalById(route.id)(s)
      : route.page === "plan-preview"
      ? selectors.goalById(route.goalId)(s)
      : undefined,
  );
  const run = useAutopilot((s) => (route.page === "run-detail" ? selectors.runById(route.id)(s) : undefined));
  const proof = useAutopilot((s) => (route.page === "proof-detail" ? selectors.proofById(route.id)(s) : undefined));
  const operator = useAutopilot((s) =>
    route.page === "operator-detail" ? selectors.operatorById(route.id)(s) : undefined,
  );
  const policy = useAutopilot((s) =>
    route.page === "policy-detail" ? s.policies.find((p) => p.id === route.id) : undefined,
  );
  const snapshot = useAutopilot((s) => s.snapshot);

  return (
    <div className="ap-app__topline">
      <nav className="ap-app__crumb" aria-label="Breadcrumb">
        <button
          type="button"
          className="ap-app__crumb-item ap-linklike"
          style={{ color: "var(--fg-subtle)" }}
          onClick={() => onNavigate({ page: "overview" })}
        >
          Autopilot
        </button>
        {renderCrumb(route, onNavigate, {
          goalName: goal?.name,
          runId: run?.id,
          proofId: proof?.id,
          operatorName: operator?.displayName,
          policyName: policy?.name,
        })}
      </nav>
      <span className="ap-app__topline-sep" />
      <span className="ap-app__topline-sub" title={snapshot.id}>
        snap <span className="ap-mono" style={{ color: "var(--fg)" }}>{snapshot.repoRevision}</span>
      </span>
    </div>
  );
}

interface CrumbCtx {
  goalName?: string;
  runId?: string;
  proofId?: string;
  operatorName?: string;
  policyName?: string;
}

function renderCrumb(
  route: AutopilotRoute,
  onNavigate: (next: AutopilotRoute) => void,
  ctx: CrumbCtx,
): React.ReactNode {
  if (route.page === "overview") return null;
  const parts: { label: string; go?: () => void }[] = [];
  switch (route.page) {
    case "goals":
      parts.push({ label: "Goals" });
      break;
    case "goal-detail":
      parts.push({ label: "Goals", go: () => onNavigate({ page: "goals" }) });
      parts.push({ label: ctx.goalName ?? "Goal" });
      break;
    case "goal-new":
      parts.push({ label: "Goals", go: () => onNavigate({ page: "goals" }) });
      parts.push({ label: "New goal" });
      break;
    case "plan-preview":
      parts.push({ label: "Goals", go: () => onNavigate({ page: "goals" }) });
      parts.push({ label: ctx.goalName ?? "Goal", go: () => onNavigate({ page: "goal-detail", id: route.goalId }) });
      parts.push({ label: "Plan preview" });
      break;
    case "runs":
      parts.push({ label: "Runs" });
      break;
    case "run-detail":
      parts.push({ label: "Runs", go: () => onNavigate({ page: "runs" }) });
      parts.push({ label: `Run · ${ctx.runId ?? route.id}` });
      break;
    case "proof-detail":
      parts.push({ label: "Runs", go: () => onNavigate({ page: "runs" }) });
      parts.push({ label: `Proof · ${ctx.proofId ?? route.id}` });
      break;
    case "workitems":
      parts.push({ label: "Work items" });
      break;
    case "opportunities":
      parts.push({ label: "Opportunities" });
      break;
    case "operators":
      parts.push({ label: "Operators" });
      break;
    case "operator-detail":
      parts.push({ label: "Operators", go: () => onNavigate({ page: "operators" }) });
      parts.push({ label: ctx.operatorName ?? route.id });
      break;
    case "policies":
      parts.push({ label: "Policies" });
      break;
    case "policy-detail":
      parts.push({ label: "Policies", go: () => onNavigate({ page: "policies" }) });
      parts.push({ label: ctx.policyName ?? route.id });
      break;
    case "snapshot":
      parts.push({ label: "Snapshot" });
      break;
  }
  return (
    <>
      {parts.map((p, i) => {
        const isLast = i === parts.length - 1;
        return (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <ChevronRight size={12} strokeWidth={1.8} className="ap-app__crumb-sep" aria-hidden />
            {p.go != null && !isLast ? (
              <button
                type="button"
                className="ap-app__crumb-item ap-linklike"
                style={{ color: "var(--fg-subtle)" }}
                onClick={p.go}
              >
                {p.label}
              </button>
            ) : (
              <span className={`ap-app__crumb-item ${isLast ? "ap-app__crumb-item--now" : ""}`}>
                {p.label}
              </span>
            )}
          </span>
        );
      })}
    </>
  );
}
