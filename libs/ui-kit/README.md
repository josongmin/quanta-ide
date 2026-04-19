# @quanta/ui-kit

Shared UI primitives, utilities, and design-system components.

## Responsibility

- Provide reusable, accessible UI components (Modal, ToastHost, Section, EmptyPane, ResizeHandle)
- Own utility functions: `cn` (class merge), `fuzzy-search`, `useDebounce`, `focusManager`, `useScrollRestoration`
- Supply engine-specific icon sets (EngineIcons, FileIcons, Sparkline) and the icon pack system
- Expose risk-color helpers and file-type detection logic

## Dependencies

- `@quanta/shell-contract` -- reads `IconPackId` for the icon pack system

## Public API

- **Lib:** `cn`, `matchPositions`, `positionScore`, `useDebounce`, `useDebouncedCallback`, `focusManager`, `useScrollRestoration`, `riskColor`, `riskColorBg`, `riskBarStyle`
- **Icons:** `IconTaint`, `IconComplexity`, `IconDead`, `IconFunction`, `IconClass`, `ChevronIcon`, `FolderIcon`, `pickFileIcon`, `Sparkline`, `ICON_PACKS`, `useActivePack`, `detectFileType`
- **Components:** `Modal`, `ToastHost`, `Section`, `Sub`, `EmptyPane`, `ResizeHandle`

## Architecture notes

Stateless and side-effect-free. Components accept props only -- no internal stores. The icon pack system reads the active pack ID from shell-contract context and resolves to the correct icon set at render time.
