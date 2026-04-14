# quanta-ide — agent instructions

Single source of truth for AI assistants (Cursor, Claude Code, Codex, etc.) working in this repository.

## Layout

- **Frontend:** `p0-ide/` — Vite + React + TypeScript (`package.json` name: `quanta-ide`).
- **Backend (Tauri):** `p0-ide/src-tauri/` — Rust, edition 2024, hexagonal architecture.
- **App URL (dev):** `http://localhost:5173/ide/` — SPA `base` is `/ide/` (see `p0-ide/vite.config.ts`).
- **CI / security:** `.github/workflows/` at repo root; Semgrep, Gitleaks, CodeQL, Dependabot.
- **Custom Semgrep rules:** `.semgrep/` — architecture and quality enforcement.

## Commands (run from `p0-ide/` unless noted)

| Task | Command |
|------|---------|
| Install | `pnpm install` |
| Dev server (web) | `pnpm dev` or `just dev` |
| Dev server (Tauri) | `pnpm tauri:dev` |
| Lint (TS) | `pnpm lint` |
| Lint (Rust) | `pnpm tauri:clippy` |
| Format check (Rust) | `pnpm tauri:fmt` |
| Typecheck | `pnpm typecheck` |
| Tests (TS) | `pnpm test` |
| Tests (Rust) | `pnpm tauri:test` |
| Gate (TS: type + lint + test) | `pnpm validate` |
| Gate (Rust: fmt + clippy + test) | `pnpm tauri:validate` |
| Full gate (+ build + coverage) | `pnpm validate:full` |
| Semgrep (local) | `semgrep scan --config .semgrep/ .` |
| Dependency audit | `pnpm security:audit` |
| Build (web) | `pnpm build` |
| Build (Tauri) | `pnpm tauri:build` |

Use **pnpm** only; `packageManager` is pinned in `p0-ide/package.json`.

## Frontend code style

- Match existing patterns: FSD-style layers under `p0-ide/src/` (`app/`, `widgets/`, `features/`, `entities/`, `shared/`).
- **FSD dependency rule (enforced by Semgrep):**
  - `shared/` → imports nothing above it
  - `entities/` → may import `shared/`
  - `features/` → may import `entities/`, `shared/`
  - `widgets/` → may import `features/`, `entities/`, `shared/`
  - `app/` → may import anything
- **No `@tauri-apps/api` in `shared/` or `entities/`** — platform-agnostic layers.
- ESLint is strict (type-checked TS, React, a11y, import-x). Fix new violations; do not weaken config.
- Path alias: `@/*` → `p0-ide/src/*`.

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

Current `mock-engine.ts` and `mock-*.ts` files hold **stand-in data wired to real UI contracts** — the shapes represent what the engine will emit. Treat the types as the contract: when backend endpoints come online, swap the mock module for a live source without touching UI code. Don't soften lint/security findings in mock files unless asked.

### v2 IDE — overlay layers (p0-ide-v2)

- **L1 passive** — gutter glyphs, function-header line widget, tab banner, right-margin risk minimap
- **L2 hover** — symbol popup (with flow preview), call-site popup (taint path + effects)
- **L3 inspector modes** — Overview / Flow / Blast / Incidents / Behavior / Ownership, driven by `focus-store`
- **L4 active** — `⌘⇧S` simulate change, `⌘E` ask agent with auto-injected context, `⌘1–6` switch inspector mode

Engine data flows through `src/entities/engine/` (types + mock source + focus store). Widgets read from the entity layer; never hard-code facts inside widgets.

## AI agent — things you must NOT do

1. **Never weaken lint rules.** Do not add `#[allow(...)]` without a comment explaining why. Do not lower Clippy/ESLint severity. If a rule is annoying, discuss with the maintainer.
2. **Never put business logic in adapters.** Tauri commands must be thin: validate → call service → map result. No domain logic.
3. **Never put framework types in domain.** No `tauri::State`, no `serde::Serialize` on domain models, no `AppHandle` passed into services.
4. **Never add dependencies without justification.** Especially `tokio` features — Tauri manages its own runtime. Especially `unsafe` crates.
5. **Never create empty placeholder modules.** No "for future use" code. Write code when you need it.
6. **Never use `println!`/`dbg!`/`unwrap` in production paths.** Use `log` crate. Propagate errors with `?`.
7. **Never bypass the composition root.** All DI wiring happens in `lib.rs::run()`. Don't instantiate infrastructure types inside services.
8. **Never import upward in FSD layers.** `shared` → nothing above. `features` → nothing above `entities`.
9. **Never commit with Clippy warnings.** Run `pnpm tauri:validate` before considering Rust work done.
10. **Never commit `@ts-ignore`.** Use `@ts-expect-error` with explanation if truly necessary.

## Docs split

- **This file (`.ai/AGENT.md`):** repo facts, commands, boundaries.
- **Root stubs:** `AGENTS.md`, `CLAUDE.md`, and `.cursor/rules/*.mdc` only **point here** — edit policy in one place (this file).
