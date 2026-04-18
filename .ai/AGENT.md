# quanta-ide — agent instructions

Single source of truth for AI assistants (Cursor, Claude Code, Codex, etc.) working in this repository.

## Layout

- **Frontend:** `p0-ide-v2/` — pnpm workspace, Vite + React + TypeScript (`package.json` name: `quanta-ide-v2`).
- **Desktop (Tauri):** `desktop/src-tauri/` — Rust, edition 2024, hexagonal shell. The WebView loads the UI built from `p0-ide-v2` (see `desktop/src-tauri/tauri.conf.json`).
- **App URL (dev, web):** `http://localhost:5174/ide/` — SPA `base` is `/ide/` when not running under Tauri (see `p0-ide-v2/vite.config.ts`).
- **CI / security:** `.github/workflows/` at repo root; Semgrep, Gitleaks, CodeQL, Dependabot.
- **Custom Semgrep rules:** `.semgrep/` — architecture and quality enforcement.

## Commands

Use **pnpm** only; `packageManager` is pinned in `p0-ide-v2/package.json` and `desktop/package.json`.

### `p0-ide-v2/` (web app)

| Task | Command |
|------|---------|
| Install | `pnpm install` |
| Dev server | `pnpm dev` |
| Lint (TS) | `pnpm lint` |
| Typecheck | `pnpm typecheck` |
| Tests | `pnpm test` |
| Gate (type + lint + test) | `pnpm validate` |
| Build (web) | `pnpm build` |
| E2E | `pnpm e2e` |

### `desktop/` (Tauri)

| Task | Command |
|------|---------|
| Install | `pnpm install` |
| Dev (Tauri + web) | `pnpm tauri:dev` |
| Lint (Rust) | `pnpm tauri:clippy` |
| Format check (Rust) | `pnpm tauri:fmt` |
| Tests (Rust) | `pnpm tauri:test` |
| Gate (Rust: fmt + clippy + test) | `pnpm tauri:validate` |
| Build (desktop bundle) | `pnpm tauri:build` |

### Repo-wide

| Task | Command |
|------|---------|
| Semgrep (local) | `semgrep scan --config .semgrep/ .` |
| Dependency audit (frontend) | `pnpm audit --audit-level=high` (from `p0-ide-v2/`) |

## Frontend code style

- Code lives in `p0-ide-v2/packages/<name>/src/` (monorepo). Match the style of the nearest package: co-locate `widgets/`, `features/`, `entities/`, `pages/` where that package uses them.
- **No `@tauri-apps/api` in `packages/domain-types/` or `packages/ui-kit/`** — Semgrep enforces platform-agnostic boundaries there; call Tauri from app or shell code.
- ESLint is strict (type-checked TS, React, a11y). Fix new violations; do not weaken config.
- Path aliases are defined in `p0-ide-v2/vite.config.ts` (`@quanta/*`).

## Rust / Tauri code style

### Hexagonal architecture (ENFORCED by Semgrep + Clippy)

```
src-tauri/src/
├── domain/         ← innermost ring: pure logic, zero deps
│   ├── model/      ← entities, value objects
│   ├── port/       ← trait interfaces (contracts)
│   └── error.rs    ← DomainError
├── application/    ← use-case orchestration
├── infrastructure/ ← driven adapters (port implementations)
├── adapter/        ← driving adapters (inbound)
│   └── tauri_cmd/  ← #[tauri::command] handlers
├── lib.rs          ← composition root (DI wiring)
└── main.rs         ← binary entry point
```

### Dependency rule (arrows point inward ONLY)

```
adapter, infrastructure → application → domain
```

Violations are **blocked by Semgrep** (`.semgrep/rust-architecture.yml`):

| Forbidden | Reason |
|-----------|--------|
| `domain` imports `application`, `infrastructure`, or `adapter` | Domain is pure |
| `application` imports `infrastructure` or `adapter` | App uses ports, not impls |
| `infrastructure` imports `adapter` | Both outer-ring, independent |
| `domain` uses `tauri::` or `serde::Serialize/Deserialize` | Framework leakage |
| `application` uses `tauri::` | Framework leakage |
| `#[tauri::command]` outside `adapter/` | SRP violation |

### ABSOLUTE PROHIBITIONS (Rust)

| Rule | Mechanism |
|------|-----------|
| `unsafe` code | `forbid` in Cargo.toml — **cannot be overridden** |
| `dbg!()` macro | `deny` — will not compile |
| `println!` / `eprintln!` in lib code | Semgrep ERROR — use `log` crate |
| `std::process::exit` outside main | Semgrep ERROR — return errors upward |
| `.unwrap()` / `.expect()` | Clippy `warn` — must justify with `#[allow]` + comment |
| `todo!()` / `unimplemented!()` | Clippy `warn` — not allowed in PR-ready code |

### Adding new modules

- **DO NOT** pre-create empty modules. Add modules when a concrete use-case demands them (YAGNI).
- New infrastructure modules go in `infrastructure/`, new commands in `adapter/tauri_cmd/`.
- Application services depend on domain ports (traits), never concrete infra types.
- Inject concrete implementations at the composition root (`lib.rs`).

### Lint thresholds (.clippy.toml)

| Metric | Max |
|--------|-----|
| Cognitive complexity | 15 |
| Function lines | 80 |
| Function arguments | 5 |
| Struct bools | 3 |

## Product note

**This is a real product — a Software Intelligence Platform ("코드를 이해하는 인프라").**
The IDE is the delivery surface for the engine's signals (taint flow, blast radius, behavior diff, typestate, incident DNA, ownership, cost, dead code, arch rules).

`mock.ts` / `*.mock.ts` fixtures under `p0-ide-v2/packages/*/src/` hold **stand-in data wired to real UI contracts** — the shapes represent what the engine will emit. Treat the types as the contract: when backend endpoints come online, swap the mock module for a live source without touching UI code. Don't soften lint/security findings in mock files unless asked.

### v2 IDE — overlay layers (p0-ide-v2)

- **L1 passive** — gutter glyphs, function-header line widget, tab banner, right-margin risk minimap
- **L2 hover** — symbol popup (with flow preview), call-site popup (taint path + effects)
- **L3 inspector modes** — Overview / Flow / Blast / Incidents / Behavior / Ownership, driven by `focus-store`
- **L4 active** — `⌘⇧S` simulate change, `⌘E` ask agent with auto-injected context, `⌘1–6` switch inspector mode

Engine-facing types and mocks live under `packages/app-ide/src/entities/` (and related packages). Inspector mode and flow UI read from stores such as `packages/app-ide/src/stores/focus-store/`; widgets should not hard-code facts that belong in entities or engine payloads.

## AI agent — things you must NOT do

1. **Never weaken lint rules.** Do not add `#[allow(...)]` without a comment explaining why. Do not lower Clippy/ESLint severity. If a rule is annoying, discuss with the maintainer.
2. **Never put business logic in adapters.** Tauri commands must be thin: validate → call service → map result. No domain logic.
3. **Never put framework types in domain.** No `tauri::State`, no `serde::Serialize` on domain models, no `AppHandle` passed into services.
4. **Never add dependencies without justification.** Especially `tokio` features — Tauri manages its own runtime. Especially `unsafe` crates.
5. **Never create empty placeholder modules.** No "for future use" code. Write code when you need it.
6. **Never use `println!`/`dbg!`/`unwrap` in production paths.** Use `log` crate. Propagate errors with `?`.
7. **Never bypass the composition root.** All DI wiring happens in `lib.rs::run()`. Don't instantiate infrastructure types inside services.
8. **Never import upward across package boundaries** in ways that create cycles or bypass the public API of a package. Prefer explicit exports from package `index.ts` files.
9. **Never commit with Clippy warnings.** Run `pnpm tauri:validate` from `desktop/` before considering Rust work done.
10. **Never commit `@ts-ignore`.** Use `@ts-expect-error` with explanation if truly necessary.

## Docs split

- **This file (`.ai/AGENT.md`):** repo facts, commands, boundaries.
- **Root stubs:** `AGENTS.md`, `CLAUDE.md`, and `.cursor/rules/*.mdc` only **point here** — edit policy in one place (this file).
