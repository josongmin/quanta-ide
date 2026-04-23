// Internal route taxonomy for app-autopilot.
// Uses useTabRoute().path segments — no react-router.

export type AutopilotRoute =
  | { page: "overview" }
  | { page: "goals" }
  | { page: "goal-detail"; id: string }
  | { page: "goal-new" }
  | { page: "plan-preview"; goalId: string }
  | { page: "runs" }
  | { page: "run-detail"; id: string }
  | { page: "proof-detail"; id: string }
  | { page: "workitems" }
  | { page: "opportunities" }
  | { page: "operators" }
  | { page: "operator-detail"; id: string }
  | { page: "policies" }
  | { page: "policy-detail"; id: string }
  | { page: "snapshot" };

export type AutopilotPage = AutopilotRoute["page"];

export function parseRoute(path: string[]): AutopilotRoute {
  const [a, b, c] = path;
  if (!a) return { page: "overview" };
  if (a === "goals") {
    if (b === "new") return { page: "goal-new" };
    if (b && c === "plan") return { page: "plan-preview", goalId: b };
    if (b) return { page: "goal-detail", id: b };
    return { page: "goals" };
  }
  if (a === "runs") {
    if (b) return { page: "run-detail", id: b };
    return { page: "runs" };
  }
  if (a === "proofs" && b) return { page: "proof-detail", id: b };
  if (a === "workitems") return { page: "workitems" };
  if (a === "opportunities") return { page: "opportunities" };
  if (a === "operators") {
    if (b) return { page: "operator-detail", id: b };
    return { page: "operators" };
  }
  if (a === "policies") {
    if (b) return { page: "policy-detail", id: b };
    return { page: "policies" };
  }
  if (a === "snapshot") return { page: "snapshot" };
  return { page: "overview" };
}

export function toPath(route: AutopilotRoute): string[] {
  switch (route.page) {
    case "overview":
      return [];
    case "goals":
      return ["goals"];
    case "goal-detail":
      return ["goals", route.id];
    case "goal-new":
      return ["goals", "new"];
    case "plan-preview":
      return ["goals", route.goalId, "plan"];
    case "runs":
      return ["runs"];
    case "run-detail":
      return ["runs", route.id];
    case "proof-detail":
      return ["proofs", route.id];
    case "workitems":
      return ["workitems"];
    case "opportunities":
      return ["opportunities"];
    case "operators":
      return ["operators"];
    case "operator-detail":
      return ["operators", route.id];
    case "policies":
      return ["policies"];
    case "policy-detail":
      return ["policies", route.id];
    case "snapshot":
      return ["snapshot"];
  }
}
