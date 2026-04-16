import js from "@eslint/js";
import tseslint from "typescript-eslint";

/**
 * Architecture boundary rules for the micro-web shell monorepo.
 * See .ai/adr/0005-micro-web-shell-architecture.md for rationale.
 */

// ── helpers ──────────────────────────────────────────────────────────

/** Build a no-restricted-imports entry that bans a glob with a message */
const ban = (pattern, message) => ({ group: [pattern], message });

/** All app package names */
const APP_PKGS = [
  "app-ide", "app-agent", "app-pr", "app-reviews",
  "app-rules", "app-scenario", "app-settings", "app-home",
];

/** Glob matching any app-* import */
const anyApp = "@quanta/app-*";
const anyAppDeep = "@quanta/app-*/**";

// ── per-package restriction sets ─────────────────────────────────────

/** shell-contract: ZERO external @quanta imports */
const shellContractBans = [
  ban("@quanta/shell",     "shell-contract must not import shell (zero deps)"),
  ban("@quanta/shell/**",  "shell-contract must not import shell (zero deps)"),
  ban("@quanta/ui-kit",    "shell-contract must not import ui-kit (zero deps)"),
  ban("@quanta/ui-kit/**", "shell-contract must not import ui-kit (zero deps)"),
  ban(anyApp,              "shell-contract must not import app packages"),
  ban(anyAppDeep,          "shell-contract must not import app packages"),
];

/** domain-types: no shell, no apps (same isolation as ui-kit) */
const domainTypesBans = [
  ban("@quanta/shell",    "domain-types must not import shell runtime"),
  ban("@quanta/shell/**", "domain-types must not import shell runtime"),
  ban(anyApp,             "domain-types must not import app packages"),
  ban(anyAppDeep,         "domain-types must not import app packages"),
];

/** ui-kit: may import shell-contract only */
const uiKitBans = [
  ban("@quanta/shell",    "ui-kit must not import shell runtime"),
  ban("@quanta/shell/**", "ui-kit must not import shell runtime"),
  ban(anyApp,             "ui-kit must not import app packages"),
  ban(anyAppDeep,         "ui-kit must not import app packages"),
];

/** shell: must not import any app-* */
const shellBans = [
  ban(anyApp,     "shell must not import app packages — use appRegistry/overlayRegistry"),
  ban(anyAppDeep, "shell must not import app packages — use appRegistry/overlayRegistry"),
];

/** Each app-X: must not import other app-Y */
function appBans(selfPkg) {
  return APP_PKGS
    .filter((p) => p !== selfPkg)
    .flatMap((p) => [
      ban(`@quanta/${p}`,    `app packages must not import from other apps (${p})`),
      ban(`@quanta/${p}/**`, `app packages must not import from other apps (${p})`),
    ]);
}

/** Legacy @/ alias — banned everywhere */
const legacyBan = [ban("@/*", "Legacy @/ alias removed — use @quanta/* packages")];

// ── config ───────────────────────────────────────────────────────────

export default tseslint.config(
  // Global ignores
  { ignores: ["dist/**", "node_modules/**", "*.config.*"] },

  // Base recommended rules
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // ── Global rules (all packages) ────────────────────────────────────
  {
    files: ["packages/*/src/**/*.{ts,tsx}", "src/**/*.{ts,tsx}"],
    rules: {
      // Ban legacy @/ alias everywhere
      "no-restricted-imports": ["error", { patterns: legacyBan }],

      // Enforce no unused vars (underscore prefix OK)
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      }],

      // No explicit any
      "@typescript-eslint/no-explicit-any": "warn",

      // No console in production code
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },

  // ── shell-contract: strictest isolation ────────────────────────────
  {
    files: ["packages/shell-contract/src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [...legacyBan, ...shellContractBans],
      }],
    },
  },

  // ── domain-types: no shell runtime, no apps ────────────────────────
  {
    files: ["packages/domain-types/src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [...legacyBan, ...domainTypesBans],
      }],
    },
  },

  // ── ui-kit: no shell runtime, no apps ──────────────────────────────
  {
    files: ["packages/ui-kit/src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [...legacyBan, ...uiKitBans],
      }],
    },
  },

  // ── shell: no app imports ──────────────────────────────────────────
  {
    files: ["packages/shell/src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [...legacyBan, ...shellBans],
      }],
    },
  },

  // ── app packages: no cross-app imports ─────────────────────────────
  ...APP_PKGS.map((pkg) => ({
    files: [`packages/${pkg}/src/**/*.{ts,tsx}`],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [...legacyBan, ...appBans(pkg)],
      }],
    },
  })),
);
