# @quanta/shell

Root orchestrator that renders the tab chrome, global overlays, and all shell-level infrastructure.

## Responsibility

- Manage the tab lifecycle: create, select, close, persist via `useTabManager`
- Maintain shell-level stores: toast, UI bus, tab bus, shortcut registry, feature registry, icon pack
- Render the topbar, command palette, dev console, and home picker widgets
- Provide `appRegistry` (lazy app loading) and `overlayRegistry` (dynamic overlay mounting)
- Implement `createShellAPI` which satisfies the `ShellAPI` contract for all tab apps

## Dependencies

- `@quanta/shell-contract` -- implements the contract types
- `@quanta/ui-kit` -- uses `ToastHost`, `cn`, `fuzzy-search`

## Public API

- `Shell` -- root component
- `appRegistry` -- register/get `TabAppDescriptor` entries
- `overlayRegistry`, `useOverlays` -- dynamic overlay system
- `useTabManager`, `TabState` -- tab lifecycle hook
- `ShellProviderWrapper` -- wires `ShellAPI` into context
- `createShellAPI` -- factory for the shell API implementation
- `TabRenderer` -- renders a tab's component via the registry

## Architecture notes

The shell never imports from any `app-*` package. Apps register themselves into `appRegistry` at startup; the shell resolves them by `AppKind` at render time. Global shortcuts and overlays are contributed by apps via the `ShellAPI.registerShortcuts` / `registerOverlay` disposer pattern.
