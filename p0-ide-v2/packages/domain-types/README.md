# @quanta/domain-types

Shared domain models, stores, and pure logic used across multiple app packages.

## Responsibility

- Own the agent-rules domain: parser, multi-adapter build pipeline, rules store, sample data
- Own the counterfactual domain: projector, scenario store, trajectory/cascade types
- Provide framework-agnostic domain types consumed by app-rules, app-scenario, and app-ide

## Dependencies

None. Pure domain package with no `@quanta/*` imports.

## Public API

- **Agent rules:** `parseRules`, `stringifyDocument`, `buildDocument`, `BUILTIN_ADAPTERS`, `getAdapter`, `rulesStore`, `useRulesStore`, `SAMPLE_RULES_SOURCE`
- **Agent rules types:** `RulesDocument`, `RulesSection`, `Adapter`, `BuildResult`, `Diagnostic`
- **Counterfactual:** `project`, `counterfactualStore`, `useCounterfactualStore`
- **Counterfactual types:** `ScenarioId`, `Projection`, `CascadeNode`, `Trajectory`, `CostEstimate`, `PredictedIncident`

## Architecture notes

Leaf dependency alongside shell-contract. Contains Zustand stores (`rulesStore`, `counterfactualStore`) that are shared across app boundaries. The agent-rules adapter system supports multiple output targets (Claude, Cursor, Copilot, neutral) from a single parsed document.
