# @quanta/app-scenario

Counterfactual scenario simulation tab application.

## Responsibility

- Render the scenario configuration UI (metric selection, horizon, parameters)
- Display counterfactual projection graphs and trajectory visualizations
- Show cascade analysis, cost estimates, and historical analog matches

## Dependencies

- `@quanta/shell-contract` -- `TabAppProps` for tab integration
- `@quanta/shell` -- tab bus
- `@quanta/domain-types` -- counterfactual store, projector, scenario/trajectory types
- `@quanta/ui-kit` -- `cn` utility

## Public API

- `scenarioDescriptor` -- `TabAppDescriptor` for shell registration
- `ScenarioApp` -- root component

## Architecture notes

Features a `counterfactual-graph` feature module for rendering projection charts. Delegates all projection math and store state to `@quanta/domain-types/counterfactual`, keeping the app layer focused on presentation.
