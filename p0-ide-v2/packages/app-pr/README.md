# @quanta/app-pr

Pull request review tab application with diff viewer and engine findings.

## Responsibility

- Render PR diff views with inline engine annotations
- Display findings sidebar (taint paths, blast radius, risk scores per changed file)
- Provide the review workflow UI (approve, request changes, comment)

## Dependencies

- `@quanta/shell-contract` -- `TabAppProps` for tab integration
- `@quanta/ui-kit` -- `cn` utility

## Public API

- `prAppDescriptor` -- `TabAppDescriptor` for shell registration
- `PrApp` -- root component

## Architecture notes

Self-contained app. PrPage owns its own sidebar, diff views, findings, and review panels internally. Entity layer holds PR metadata and diff models.
