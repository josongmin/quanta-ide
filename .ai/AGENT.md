# quanta-ide — agent instructions

Single source of truth for AI assistants (Cursor, Claude Code, Codex, etc.) working in this repository.

## Layout

Repo-root pnpm workspace (`pnpm-workspace.yaml` at repo root).
Three tiers:

- **`libs/*`** — reusable libraries, each a real workspace package with its own `package.json` + `tsconfig.json`. Contains: `domain-types`, `shell-contract`, `canvas-engine`, `canvas-pixi`, `canvas-worker`, `ui-kit`, `shell`. Any surface may depend on a lib; libs cannot depend on products or the host. Libs use **incremental non-composite** TypeScript (composite + source-level paths hits TS6059 — "file not under rootDir" — when cross-lib resolution pulls source files into the importing project). Cross-lib resolution goes through per-lib `tsconfig paths`.
- **`products/*`** — product packages exported as React components (internal FSD: `app > pages > widgets > features > entities > shared`). Two products may NOT import each other — share via `libs/`. Current: `products/code-universe/` (see its README).
- **`p0-ide-v2/`** — the runnable Vite + React + TypeScript web app (`package.json` name: `quanta-ide-v2`). Hosts traditional editor/admin features under `p0-ide-v2/packages/app-*/` (Vite path-alias, not workspace packages). Declares each lib as `"@quanta/<lib>": "workspace:*"`. Mounts products via routes.

Other:

- **Desktop (Tauri):** `desktop/src-tauri/` — Rust, edition 2024, hexagonal shell. The WebView loads the UI built from `p0-ide-v2` (see `desktop/src-tauri/tauri.conf.json`: `frontendDist: "../../p0-ide-v2/dist"`). Desktop is a separate pnpm tree — not part of the web workspace.
- **App URL (dev, web):** `http://localhost:5174/ide/` — SPA `base` is `/ide/` when not running under Tauri (see `p0-ide-v2/vite.config.ts`).
- **CI / security:** `.github/workflows/` at repo root; Semgrep, Gitleaks, CodeQL, Dependabot.
- **Custom Semgrep rules:** `.semgrep/` — architecture, quality, **and FSD layer enforcement** (`fsd-layers.yml` — upward-import, slice isolation, cross-product isolation).

## Commands

Use **pnpm** only; `packageManager` is pinned in the repo-root `package.json` and in `desktop/package.json`.

### Web workspace (repo root — preferred entry)

Run from the repo root. These scripts fan out across `libs/*`, `products/*`, and `p0-ide-v2`:

| Task | Command |
|------|---------|
| Install everything | `pnpm install` |
| Dev server (p0-ide-v2) | `pnpm dev` |
| Typecheck (all packages) | `pnpm typecheck` |
| Lint (p0-ide-v2 ESLint rules) | `pnpm lint` |
| Tests (recursive) | `pnpm test` |
| Gate (type + lint + test) | `pnpm validate` |
| Build (web) | `pnpm build` |
| E2E | `pnpm e2e` |

Running a command against a single package: `pnpm --filter @quanta/code-universe test`, `pnpm --filter quanta-ide-v2 build`, etc.

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
| Artifact-location gate | `just check-artifacts` (see §build-artifacts) |

## Build artifacts — kept out of the working tree

Every build output / cache is redirected to `~/.cache/quanta-ide/` to keep IDE
indexing fast (the Cargo target alone is ~5 GB). Do NOT revert these; the CI
job `artifact-locations` + Semgrep rules in `.semgrep/artifact-locations.yml`
will block PRs that do.

| Artifact | Redirect mechanism | External location |
|----------|--------------------|-------------------|
| Cargo target (`desktop/src-tauri/target/`) | `desktop/src-tauri/.cargo/config.toml` (gitignored, user-local absolute path) | `~/.cache/quanta-ide/cargo-target/` |
| pnpm virtual store (`node_modules/.pnpm/`) | root `.npmrc` (covers the web workspace: libs/products/p0-ide-v2) + `desktop/.npmrc` (standalone) via `virtual-store-dir=${HOME}/...` | `~/.cache/quanta-ide/pnpm-virtual-store/{root,desktop}/` |
| Vite dev cache (`node_modules/.vite/`) | `cacheDir` in `p0-ide-v2/vite.config.ts` | `~/.cache/quanta-ide/vite/p0-ide-v2/` |
| Playwright results (dev only) | `outputDir`/`reporter` in `p0-ide-v2/playwright.config.ts` — CI uses default `test-results/` so `actions/upload-artifact` still works | `~/.cache/quanta-ide/playwright/` |

**Stays in-tree (cannot be moved without breaking tooling):**

- `p0-ide-v2/dist/` — Tauri's `frontendDist` references `../../p0-ide-v2/dist`
- `desktop/src-tauri/gen/` — `build.rs` expects adjacent path
- `tsconfig.*.tsbuildinfo` — 70 KB, absolute `tsBuildInfoFile` would break other contributors
- `node_modules/` (top-level symlinks only, ~65 MB after `pnpm install`)

All of the above are in `.vscode/settings.json` under `files.exclude` /
`files.watcherExclude` / `search.exclude` so the IDE does not index them.

### Migrating an existing checkout

```bash
# desktop (Cargo target)
cp .ai/snippets/cargo-config-example.toml desktop/src-tauri/.cargo/config.toml
# edit the absolute path to match your $HOME, then rebuild:
pnpm --dir desktop tauri:build   # or: cargo clean && cargo build

# pnpm virtual store (needs a clean install — workspace root is now the repo root)
pnpm install                           # from repo root — handles libs/*, products/*, p0-ide-v2
cd desktop && rm -rf node_modules && pnpm install  # desktop is a separate tree (Tauri)
```

### What NOT to do (enforced)

- Do not set `cacheDir`, `outputDir`, or similar to an in-repo path — blocked
  by `.semgrep/artifact-locations.yml`.
- Do not add `virtual-store-dir=./...` or `virtual-store-dir=node_modules/...`
  to any `.npmrc` — blocked.
- Do not commit `desktop/src-tauri/.cargo/config.toml` — it is user-local and
  gitignored on purpose (the path is absolute).
- Do not commit `target-dir = ...` to `Cargo.toml` — blocked.

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

## Naming conventions (canvas codebase)

- `build*`   — allocate a structured result from a spec (layouts, views, queries)
- `compute*` — run a graph / numeric algorithm (metrics, neighborhood, paths)
- `create*` — factory for stateful objects (stores, spatial indexes, registries)
- `resolve*` — pick one value from many inputs (effective tier, edge style, fallback)
- `derive*`  — pure transform, no allocation beyond return value (layer from kind)
- `rank*`   — sort + slice top-N (start-here)
- `find*`    — search/filter (paths, SCCs)
- `detect*`  — boolean-ish finding (violations)

## Docs split

- **This file (`.ai/AGENT.md`):** repo facts, commands, boundaries.
- **Root stubs:** `AGENTS.md`, `CLAUDE.md`, and `.cursor/rules/*.mdc` only **point here** — edit policy in one place (this file).
