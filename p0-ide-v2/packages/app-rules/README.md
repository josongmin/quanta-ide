# @quanta/app-rules

Agent rules authoring and compliance tab application.

## Responsibility

- Provide the rules editor page for authoring agent instruction documents
- Render the global RulesModal overlay for quick rule access from any tab
- Display compliance entity data and rule violation summaries

## Dependencies

- `@quanta/shell-contract` -- `TabAppProps`, `useShell` for overlay registration
- `@quanta/shell` -- tab bus, toast store, UI bus
- `@quanta/domain-types` -- agent-rules parser, adapters, build pipeline, rules store
- `@quanta/ui-kit` -- `cn` utility

## Public API

- `rulesDescriptor` -- `TabAppDescriptor` for shell registration
- `RulesApp` -- root component

## Architecture notes

Registers a global `RulesModal` overlay via `shell.registerOverlay` on mount, allowing rule access from any context. Depends heavily on `@quanta/domain-types/agent-rules` for the parse-build-render pipeline and multi-adapter output (Claude, Cursor, Copilot).
