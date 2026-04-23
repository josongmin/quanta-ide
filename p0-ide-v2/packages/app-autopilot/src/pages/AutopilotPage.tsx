import { useCallback, useEffect, useMemo } from "react";
import { useTabRoute } from "@quanta/shell-contract";
import { TopBar } from "@quanta/app-autopilot/widgets/top-bar";
import {
  parseRoute,
  toPath,
  type AutopilotPage as AutopilotPageId,
  type AutopilotRoute,
} from "@quanta/app-autopilot/shared/lib";
import { OverviewPage } from "./overview/ui/OverviewPage";
import { GoalsPage } from "./goals/ui/GoalsPage";
import { GoalDetailPage } from "./goal-detail/ui/GoalDetailPage";
import { GoalNewPage } from "./goal-new/ui/GoalNewPage";
import { PlanPreviewPage } from "./plan-preview/ui/PlanPreviewPage";
import { RunsPage } from "./runs/ui/RunsPage";
import { RunDetailPage } from "./run-detail/ui/RunDetailPage";
import { ProofDetailPage } from "./proof-detail/ui/ProofDetailPage";
import { WorkItemsPage } from "./workitems/ui/WorkItemsPage";
import { OpportunitiesPage } from "./opportunities/ui/OpportunitiesPage";
import { OperatorsPage } from "./operators/ui/OperatorsPage";
import { OperatorDetailPage } from "./operator-detail/ui/OperatorDetailPage";
import { PoliciesPage } from "./policies/ui/PoliciesPage";
import { PolicyDetailPage } from "./policy-detail/ui/PolicyDetailPage";
import { SnapshotPage } from "./snapshot/ui/SnapshotPage";
import { TopLine } from "./internal/TopLine";
import { useAutopilotShortcuts } from "./internal/use-autopilot-shortcuts";
import "./autopilot-page.css";

export function AutopilotPage() {
  const { path, setPath } = useTabRoute();
  const route = useMemo<AutopilotRoute>(() => parseRoute(path), [path]);

  const navigate = useCallback(
    (next: AutopilotRoute, mode: "push" | "replace" = "push") => {
      setPath(toPath(next), mode);
    },
    [setPath],
  );

  const navigateByPage = useCallback(
    (page: AutopilotPageId) => {
      const NON_ROOT = new Set<AutopilotPageId>([
        "goal-detail",
        "goal-new",
        "plan-preview",
        "run-detail",
        "proof-detail",
        "operator-detail",
        "policy-detail",
      ]);
      if (NON_ROOT.has(page)) {
        navigate({ page: "overview" });
      } else {
        navigate({ page } as AutopilotRoute);
      }
    },
    [navigate],
  );

  // Ensure URL normalized on mount (overview → empty path).
  useEffect(() => {
    if (route.page === "overview" && path.length > 0) {
      setPath([], "replace");
    }
  }, [route.page, path.length, setPath]);

  useAutopilotShortcuts({ route, navigate });

  const isDetailPage = isDrillIn(route);

  return (
    <div className="ap-app">
      <div className="ap-app__shell">
        <TopBar current={rootPage(route)} onNavigate={navigateByPage} />
        {isDetailPage && <TopLine route={route} onNavigate={navigate} />}
        <div className="ap-app__stage">
          <RouteView route={route} navigate={navigate} />
        </div>
      </div>
    </div>
  );
}

function rootPage(route: AutopilotRoute): AutopilotPageId {
  if (route.page === "goal-detail" || route.page === "goal-new" || route.page === "plan-preview") return "goals";
  if (route.page === "run-detail" || route.page === "proof-detail") return "runs";
  if (route.page === "operator-detail") return "operators";
  if (route.page === "policy-detail") return "policies";
  return route.page;
}

function isDrillIn(route: AutopilotRoute): boolean {
  return (
    route.page === "goal-detail" ||
    route.page === "goal-new" ||
    route.page === "plan-preview" ||
    route.page === "run-detail" ||
    route.page === "proof-detail" ||
    route.page === "operator-detail" ||
    route.page === "policy-detail"
  );
}

function RouteView({
  route,
  navigate,
}: {
  route: AutopilotRoute;
  navigate: (next: AutopilotRoute, mode?: "push" | "replace") => void;
}) {
  switch (route.page) {
    case "overview":
      return <OverviewPage navigate={navigate} />;
    case "goals":
      return <GoalsPage navigate={navigate} />;
    case "goal-detail":
      return <GoalDetailPage goalId={route.id} navigate={navigate} />;
    case "goal-new":
      return <GoalNewPage navigate={navigate} />;
    case "plan-preview":
      return <PlanPreviewPage goalId={route.goalId} navigate={navigate} />;
    case "runs":
      return <RunsPage navigate={navigate} />;
    case "run-detail":
      return <RunDetailPage runId={route.id} navigate={navigate} />;
    case "proof-detail":
      return <ProofDetailPage proofId={route.id} navigate={navigate} />;
    case "workitems":
      return <WorkItemsPage navigate={navigate} />;
    case "opportunities":
      return <OpportunitiesPage navigate={navigate} />;
    case "operators":
      return <OperatorsPage navigate={navigate} />;
    case "operator-detail":
      return <OperatorDetailPage operatorId={route.id} navigate={navigate} />;
    case "policies":
      return <PoliciesPage navigate={navigate} />;
    case "policy-detail":
      return <PolicyDetailPage policyId={route.id} navigate={navigate} />;
    case "snapshot":
      return <SnapshotPage />;
  }
}
