#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────────────
# check-artifact-locations.sh
#
# Gate that keeps build artifacts out of the working tree so IDE indexing
# stays fast. Validates that every tool that writes a cache/output has been
# configured to write OUTSIDE the repo. Run locally and in CI.
#
# Scope: committed config only. Per-user files like desktop/src-tauri/.cargo/
# config.toml are checked via the gitignore rule (see POLICY).
# ────────────────────────────────────────────────────────────────────────────

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[0;33m'
RESET=$'\033[0m'

FAIL=0
pass() { echo "  ${GREEN}✓${RESET} $1"; }
fail() { echo "  ${RED}✗${RESET} $1"; FAIL=1; }
warn() { echo "  ${YELLOW}!${RESET} $1"; }
section() { echo ""; echo "── $1"; }

# ── pnpm: virtual-store-dir redirected ──────────────────────────────────────
# Repo root `.npmrc` is the authoritative config for the workspace
# (p0-ide-v2 is now a workspace member — its previous per-package
# .npmrc was removed when the workspace was hoisted to the repo root).
# `desktop/` stays standalone: Tauri doesn't share the web workspace,
# so its own .npmrc is still required.
section "pnpm virtual store"
for path in ".npmrc" "desktop/.npmrc"; do
  if [[ ! -f "$path" ]]; then
    fail "$path missing (expected virtual-store-dir outside repo)"
    continue
  fi
  if grep -qE '^virtual-store-dir=.*\$\{HOME\}/.cache/quanta-ide/' "$path"; then
    pass "$path → external virtual store"
  else
    fail "$path must set virtual-store-dir=\${HOME}/.cache/quanta-ide/..."
  fi
done

# ── Vite cacheDir redirected ────────────────────────────────────────────────
section "Vite cacheDir"
if grep -qE 'cacheDir:.*homedir\(\).*\.cache.*quanta-ide' p0-ide-v2/vite.config.ts; then
  pass "p0-ide-v2/vite.config.ts → external cacheDir"
else
  fail "p0-ide-v2/vite.config.ts must set cacheDir to ~/.cache/quanta-ide/vite/..."
fi

# ── Playwright outputDir: external in dev, default in CI ────────────────────
section "Playwright output"
if grep -qE 'outputDir:.*isCI.*test-results.*cacheRoot' p0-ide-v2/playwright.config.ts; then
  pass "p0-ide-v2/playwright.config.ts → CI-aware outputDir"
else
  fail "p0-ide-v2/playwright.config.ts must redirect outputDir/report outside repo when !CI"
fi

# ── Cargo target-dir: gitignored user-local config ──────────────────────────
section "Cargo target"
if grep -qE '^/\.cargo/config\.toml$' desktop/src-tauri/.gitignore; then
  pass "desktop/src-tauri/.gitignore excludes .cargo/config.toml (user-local override)"
else
  fail "desktop/src-tauri/.gitignore must ignore /.cargo/config.toml"
fi
if [[ -f desktop/src-tauri/.cargo/config.toml ]]; then
  if grep -qE 'target-dir.*\.cache/quanta-ide' desktop/src-tauri/.cargo/config.toml; then
    pass "local desktop/src-tauri/.cargo/config.toml → external target-dir"
  else
    warn "desktop/src-tauri/.cargo/config.toml exists but target-dir not redirected"
  fi
else
  warn "no local desktop/src-tauri/.cargo/config.toml (OK in CI; create locally to offload 5GB)"
fi
if [[ -d desktop/src-tauri/target ]]; then
  if [[ -n "${CI:-}" ]]; then
    pass "desktop/src-tauri/target/ present (OK in CI)"
  else
    fail "desktop/src-tauri/target/ exists in repo — create .cargo/config.toml to redirect"
  fi
fi

# ── VSCode indexing excludes ────────────────────────────────────────────────
section "VSCode indexing excludes"
if [[ ! -f .vscode/settings.json ]]; then
  fail ".vscode/settings.json missing"
else
  for key in "files.exclude" "files.watcherExclude" "search.exclude"; do
    if grep -q "\"$key\"" .vscode/settings.json; then
      pass ".vscode/settings.json has $key"
    else
      fail ".vscode/settings.json missing $key"
    fi
  done
fi

# ── .gitignore sanity ───────────────────────────────────────────────────────
section ".gitignore coverage"
for pattern in "node_modules/" "dist/" "\*\*/target/" "\*\.tsbuildinfo" "test-results/"; do
  if grep -qE "^$pattern|/$pattern" .gitignore 2>/dev/null; then
    pass ".gitignore covers $pattern"
  else
    fail ".gitignore missing pattern: $pattern"
  fi
done

echo ""
if [[ $FAIL -ne 0 ]]; then
  echo "${RED}FAIL${RESET} — artifact-location policy violated. See .ai/AGENT.md §build-artifacts."
  exit 1
fi
echo "${GREEN}OK${RESET} — all build artifacts point outside the repo."
