// Public API of @quanta/code-universe.
//
// Only the `app` layer's default export + the explicit graph-source
// setter are published. Everything else — widgets, features, entities,
// internal shared — stays private. Consumers cannot reach past this
// file; the FSD layer rules enforced by ESLint `boundaries` + Semgrep
// guarantee the package does not leak its internals.
export { CodeUniverse, type CodeUniverseProps } from "./app/CodeUniverse";
export {
  setWorkspaceGraph,
  getWorkspaceGraph,
} from "./shared/api/graph-source";
export { setRepoRoot, getRepoRoot } from "./shared/api/repo-root";
