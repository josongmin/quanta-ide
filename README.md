# Quanta IDE — monorepo

Vite + React + TypeScript web shell (`p0-ide-v2`) with workspace libraries (`libs/*`), product bundles (`products/*`), and an optional **Tauri** desktop app (`desktop/`). This README is the **fast path** to a working dev environment; deeper conventions live in [`.ai/AGENT.md`](.ai/AGENT.md).

---

## Requirements

| Tool | Version | Notes |
|------|---------|--------|
| **Node.js** | **≥ 20** | Enforced via root `package.json` → `engines` |
| **pnpm** | **10.33.x** | Pinned via `packageManager`; use Corepack (below) |
| **Rust** + **system deps** | stable | Only if you build **[Desktop (Tauri)](#desktop-tauri)** |

Optional: **Git**, **Chrome/Chromium** (Playwright / manual testing).

---

## Quick start (web — most contributors)

From the **repository root** (same directory as this `README.md`):

```bash
git clone <your-fork-or-upstream-url> quanta-ide
cd quanta-ide

# Pin pnpm to the repo’s packageManager field (recommended)
corepack enable
corepack prepare pnpm@10.33.0 --activate

pnpm install
pnpm dev
```

Open the app (dev `base` is `/ide/`, **not** `/`):

**[http://localhost:5174/ide/](http://localhost:5174/ide/)**

The Vite server uses **`strictPort: true`** on **5174**. If the port is taken, free it or adjust `p0-ide-v2/vite.config.ts` locally.

---

## Root scripts

Run from repo root:

| Command | What it does |
|---------|----------------|
| `pnpm install` | Installs `libs/*`, `products/*`, `p0-ide-v2` (see `pnpm-workspace.yaml`) |
| `pnpm dev` | Vite dev server → `quanta-ide-v2` |
| `pnpm build` | Production build of the web app |
| `pnpm preview` | Preview production build |
| `pnpm typecheck` | TypeScript across libs, products, and `p0-ide-v2` |
| `pnpm lint` | ESLint (host rules in `p0-ide-v2`) |
| `pnpm test` | Tests (recursive workspace) |
| `pnpm validate` | `typecheck` + catalog check + `lint` + `test` |
| `pnpm e2e` | Playwright (from `p0-ide-v2`) |

Target one package: `pnpm --filter @quanta/code-universe typecheck`, `pnpm --filter quanta-ide-v2 build`, etc.

---

## Repository layout

```
libs/*           → Shared packages (@quanta/domain-types, canvas-engine, ui-kit, …)
products/*       → Mountable product UI (e.g. code-universe); no cross-import between products
p0-ide-v2/       → Runnable Vite app (name: quanta-ide-v2) — primary web entry
desktop/         → Separate pnpm tree + Tauri/Rust shell (not part of the web workspace)
.ai/AGENT.md     → Canonical layout, CI, artifact/cache rules, “what not to do”
```

---

## Environment variables (optional)

| Variable | Where | Purpose |
|----------|--------|---------|
| `VITE_REPO_SCAN_ROOT` | `p0-ide-v2` (Vite) | Override default filesystem root for dev repo scan / graph boot |
| `TAURI_ENV_PLATFORM` | set by Tauri | Switches Vite `base` to `/` when building for the embedded webview |

No `.env` is required for a minimal **web** dev run; features that scan disk use sensible defaults (see `p0-ide-v2/vite.config.ts` and `p0-ide-v2/src/scan-defaults.ts`).

---

## Desktop (Tauri)

The web UI can run inside a native shell. **`desktop/` is its own install tree** (not merged into the root workspace).

```bash
# One-time: Rust toolchain + platform packages for Tauri
# https://tauri.app/start/prerequisites/

cd desktop
corepack prepare pnpm@10.33.0 --activate   # if not already
pnpm install
pnpm tauri:dev
```

Other useful commands (from `desktop/`): `pnpm tauri:build`, `pnpm tauri:validate`. Cargo target and caches may be redirected under `~/.cache/quanta-ide/` per [`.ai/AGENT.md`](.ai/AGENT.md) — first-time setup may need the snippet there for `desktop/src-tauri/.cargo/config.toml`.

---

## Caches & clean installs

- **pnpm** virtual store defaults to **`~/.cache/quanta-ide/pnpm-virtual-store/root`** (root `.npmrc`).
- **Vite** cache: `~/.cache/quanta-ide/vite/p0-ide-v2/`.
- If installs behave oddly: remove the relevant cache dir and run `pnpm install` again from the **same tree** (root vs `desktop/`).

---

## Troubleshooting

| Symptom | What to try |
|---------|-------------|
| Blank page at `http://localhost:5174/` | Use **`/ide/`** — SPA base is not `/` in web dev |
| `EADDRINUSE` on 5174 | Kill the process on 5174 or change port in `p0-ide-v2/vite.config.ts` (drops strict portability with teammates) |
| Wrong / old pnpm | `corepack prepare pnpm@10.33.0 --activate` |
| `pnpm install` errors after pulling | `git clean -fdx node_modules` at root is destructive; prefer deleting root `node_modules` + cache, then `pnpm install` |
| Desktop build fails (Rust) | Follow Tauri prerequisites; see **Migrating an existing checkout** in [`.ai/AGENT.md`](.ai/AGENT.md) |

---

## CI, security, architecture

- **GitHub Actions:** `.github/workflows/` (tests, Semgrep, Gitleaks, CodeQL, Dependabot).
- **Custom rules:** `.semgrep/` (includes FSD / layer boundaries).
- **Secrets scanning:** `.gitleaks.toml`.

Do not commit build artifacts into tracked paths that CI forbids — details in [`.ai/AGENT.md`](.ai/AGENT.md) § *Build artifacts*.

---

## Documentation map

| Doc | Audience |
|-----|----------|
| **This README** | Clone → run → orient |
| [`.ai/AGENT.md`](.ai/AGENT.md) | Day-to-day commands, layout, caches, gates |
| [`pnpm-workspace.yaml`](pnpm-workspace.yaml) | Package globs & tier explanation |
| Product READMEs | e.g. [`products/code-universe/README.md`](products/code-universe/README.md) |

---

## Agent / IDE helpers

Cursor, Claude Code, Codex: start from [`.ai/AGENT.md`](.ai/AGENT.md) or [`AGENTS.md`](AGENTS.md) (pointer only).
