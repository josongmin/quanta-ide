# @quanta/app-home

Home dashboard and new-tab page application.

## Responsibility

- Render the Home page overlay with workspace overview and quick actions
- Provide the New Tab page shown when a blank tab is created
- Surface feature tiles and navigation shortcuts via the shell's home picker

## Dependencies

- `@quanta/shell-contract` -- `TabAppProps` for tab integration
- `@quanta/shell` -- home picker widget

## Public API

- `homeDescriptor` -- `TabAppDescriptor` for home overlay
- `newTabDescriptor` -- `TabAppDescriptor` for the new-tab page
- `HomeApp`, `NewTabApp` -- root components

## Architecture notes

Exports two descriptors: `home` (rendered as a shell overlay when the home button is toggled) and `new-tab` (rendered as a regular tab). Both share the same package but serve distinct navigation roles.
