# @quanta/app-settings

Settings panel application for managing features, preferences, and icon packs.

## Responsibility

- Render the settings page with feature toggles and configuration fields
- Display registered features from the shell's feature registry
- Provide icon pack selection and theme preferences

## Dependencies

- `@quanta/shell-contract` -- `TabAppProps` for tab integration
- `@quanta/shell` -- feature registry, toast store
- `@quanta/ui-kit` -- `cn` utility

## Public API

- `settingsDescriptor` -- `TabAppDescriptor` for shell registration
- `SettingsApp` -- root component

## Architecture notes

Typically rendered as a shell-level overlay (when `settingsOpen` is true) rather than a regular tab, though both modes are supported via the same descriptor. Reads feature manifests from the shell's feature registry to dynamically render setting fields contributed by other apps.
