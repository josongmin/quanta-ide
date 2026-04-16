# @quanta/app-reviews

Reviews dashboard tab application listing proof-of-review PRs.

## Responsibility

- Display a filterable list of PRs with proof-of-review status
- Show review metrics and compliance summaries per repository
- Support opening individual PRs in the PR review tab

## Dependencies

- `@quanta/shell-contract` -- `TabAppProps`, `useShell`
- `@quanta/shell` -- tab bus, toast store
- `@quanta/ui-kit` -- `cn` utility

## Public API

- `reviewsDescriptor` -- `TabAppDescriptor` for shell registration
- `ReviewsApp` -- root component

## Architecture notes

Thin app. Entity layer holds proof-PR models; the single ReviewsPage composes the list and filter UI. Uses tab bus to open PRs in the app-pr tab.
