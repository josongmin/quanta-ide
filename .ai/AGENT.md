# quanta-ide — agent instructions

Single source of truth for AI assistants (Cursor, Claude Code, Codex, etc.) working in this repository.

## Layout

- **Application:** `p0-ide/` — Vite + React + TypeScript (`package.json` name: `quanta-ide`).
- **App URL (dev):** `http://localhost:5173/ide/` — SPA `base` is `/ide/` (see `p0-ide/vite.config.ts`).
- **CI / security:** `.github/workflows/` at repo root; Semgrep, Gitleaks, CodeQL, Dependabot apply to `p0-ide` where relevant.

## Commands (run from `p0-ide/` unless noted)

| Task | Command |
|------|---------|
| Install | `pnpm install` |
| Dev server | `pnpm dev` or `just dev` |
| Lint | `pnpm lint` |
| Typecheck | `pnpm typecheck` |
| Tests | `pnpm test` |
| Gate (type + lint + test) | `pnpm validate` |
| Full gate (+ build + coverage) | `pnpm validate:full` |
| Dependency audit | `pnpm security:audit` |
| Build | `pnpm build` |

Use **pnpm** only; `packageManager` is pinned in `p0-ide/package.json`.

## Code style

- Match existing patterns: FSD-style layers under `p0-ide/src/` (`app/`, `widgets/`, `features/`, `entities/`, `shared/`).
- Prefer focused diffs; avoid drive-by refactors and unrelated files.
- ESLint is strict (type-checked TS, React, a11y, import-x). Fix new violations; do not weaken config without explicit maintainer approval.
- Path alias: `@/*` → `p0-ide/src/*`.

## Product note

`IdePage` and related modules use **mock data** for the IDE demo. Treat security/lint findings in `mock-*` files as demo fixtures unless the user asks to harden them.

## Docs split

- **This file (`.ai/AGENT.md`):** repo facts, commands, boundaries.
- **Root stubs:** `AGENTS.md`, `CLAUDE.md`, and `.cursor/rules/*.mdc` only **point here** — edit policy in one place (this file).
