// Public API of @quanta/code-universe.
//
// Only the `app` layer's default export + the explicit graph-source
// setter are published. Everything else — widgets, features, entities,
// internal shared — stays private. Consumers cannot reach past this
// file; the FSD layer rules enforced by ESLint `boundaries` + Semgrep
// guarantee the package does not leak its internals.
export { CodeUniverse, type CodeUniverseProps } from "./app/CodeUniverse";
export { CodeCityTabApp, type CodeCityTabAppProps } from "./app/CodeCityTabApp";
export { DashboardView, type DashboardViewProps } from "./features/dashboard";
export {
  setWorkspaceGraph,
  getWorkspaceGraph,
  useWorkspaceGraph,
  subscribeWorkspaceGraph,
} from "./shared/api/graph-source";
export { setRepoRoot, getRepoRoot } from "./shared/api/repo-root";
export {
  setSelectedSymbol,
  getSelectedSymbol,
  useSelectedSymbol,
} from "./shared/api/selected-symbol";
