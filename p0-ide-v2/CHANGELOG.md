# Changelog

All notable changes to the p0-ide-v2 monorepo.

## [Unreleased] -- 2026-04-16

### Architecture
- Micro-web shell architecture (ADR-0005): 12 packages with enforced boundaries
- Shell-contract + ShellAPI pattern for app <-> shell communication
- Overlay registry + shortcut registry for dynamic app-to-shell registration
- AppRegistry with React.lazy code splitting (initial JS -79%)

### Quality
- ESLint architecture boundary enforcement (no-restricted-imports)
- 159 unit tests (Vitest + RTL + jest-axe)
- 13 E2E tests (Playwright)
- Storybook: 20 stories for 5 ui-kit components
- CI pipeline: typecheck -> lint -> test -> build -> bundle size -> E2E

### Design System
- 600+ token migrations (color, radius, z-index, spacing, typography)
- Typography token system (fs, fw, lh, ff)
- Half-step spacing tokens (--space-0h through --space-4h)

### Code Quality
- 16 god modules decomposed (7,874 -> 1,453 LOC)
- CSS monoliths split (inspector 3,246 + bottom-panel 2,715 LOC)
- Store ISP: focus-store (facade), git-workspace (namespace)
- RegistryEvent discriminated union
- Shared primitives: cn, fuzzy-search, Modal, useDebounce, focusManager

### Accessibility
- axe-core automated scanning in tests
- 10 component a11y fixes (nested-interactive, missing labels, aria attributes)

### Rust (src-tauri)
- YAGNI cleanup: 6 empty placeholder modules deleted
