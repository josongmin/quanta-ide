# @quanta/shell-contract

Shared type-only contract between the shell and all micro-web tab apps.

## Responsibility

- Define the `ShellAPI` interface that every tab app receives via React context
- Provide `TabApp`, `AppKind`, `TabDescriptor`, and `TabAppDescriptor` types for the tab system
- Own the `FeatureManifest` and `ShortcutBinding` contracts for dynamic registration
- Supply `ShellProvider`/`useShell`, `IconPackProvider`/`useIconPackId`, and `LayoutProvider`/`useLayout` context wrappers

## Dependencies

None. This is the leaf dependency of the monorepo -- it must never import from other `@quanta/*` packages.

## Public API

- **Types:** `ShellAPI`, `TabApp`, `AppKind`, `TabDescriptor`, `TabAppDescriptor`, `TabAppProps`
- **Feature types:** `FeatureManifest`, `FeatureCategory`, `CommandContribution`, `ShortcutContribution`, `SettingFieldContribution`
- **Context:** `ShellProvider`, `useShell`, `IconPackProvider`, `useIconPackId`, `LayoutProvider`, `useLayout`
- **Events:** `ShellEvents`, `ShellEventName`, `ShellEventPayload`
- **Other:** `ShortcutBinding`, `ToastKind`, `Toast`, `IconPackId`

## Architecture notes

Pure contract package -- exports only types and thin React context providers. No runtime logic, no side effects. Every `app-*` package depends on this; the shell implements it.
