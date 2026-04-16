# @quanta/app-ide

The primary IDE tab application -- code editor, inspector panels, sidebar, and bottom panel.

## Responsibility

- Render the full IDE layout: sidebar (file tree), editor, inspector (6 modes), and bottom panel
- Own all engine-signal entities: taint, blast radius, incidents, behavior, ownership, compliance, risk
- Provide IDE-specific features: gutter marks, symbol/call-site hovers, risk minimap, function headers
- Manage IDE overlays (simulate change, context inject, firewall) registered dynamically with the shell

## Dependencies

- `@quanta/shell-contract` -- `TabAppProps`, `useShell` for overlay/shortcut registration
- `@quanta/shell` -- feature registry, icon pack store, toast store, tab bus
- `@quanta/ui-kit` -- `Section`, `EmptyPane`, `ResizeHandle`, icons, `cn`, risk helpers
- `@quanta/domain-types` -- counterfactual projection types

## Public API

- `ideAppDescriptor` -- `TabAppDescriptor` for shell registration
- `IdeApp` -- root component
- `LayoutProvider`, `useLayout`, `LayoutCallbacks` -- resize context

## Architecture notes

Largest app package. Internally organized as FSD layers: `entities/` (data + mock sources), `features/` (inspector modes, editor overlays), `widgets/` (sidebar, inspector, bottom-panel, editor), `pages/` (IdePage composition root), `stores/` (focus-store facade, git-workspace namespace). Registers overlays and shortcuts via `useShell()` on mount, with disposer cleanup on unmount.
