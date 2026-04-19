import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import { fileURLToPath } from "node:url";

const ROOT_DIR = fileURLToPath(new URL(".", import.meta.url));

/**
 * Workspace-root ESLint config.
 *
 * Scope — applies to everything OUTSIDE p0-ide-v2/, i.e. `libs/*` and
 * `products/*`. p0-ide-v2 keeps its own eslint.config.js because that
 * tree has detailed app-package boundary rules (shell ↛ apps, apps ↛
 * other apps) that don't apply here.
 *
 * Rules:
 * - Base JS + TS + React hooks (same vocabulary as p0-ide-v2)
 * - `no-restricted-imports` guards the legacy `@/*` alias
 * - Lib isolation: domain-types/shell-contract/ui-kit/canvas-* cannot
 *   depend on app-* packages that only exist inside p0-ide-v2/
 */

const ban = (pattern, message) => ({ group: [pattern], message });

const legacyBan = [ban("@/*", "Legacy @/ alias removed — use @quanta/* packages")];

const appPkgBan = [
  ban("@quanta/app-*", "libs/* and products/* cannot depend on app-* packages (reverse dep)"),
  ban("@quanta/app-*/**", "libs/* and products/* cannot depend on app-* packages (reverse dep)"),
];

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", "*.config.*", "p0-ide-v2/**"] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ["libs/*/src/**/*.{ts,tsx}", "products/*/src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: ROOT_DIR,
      },
    },
    rules: {
      "no-restricted-imports": ["error", { patterns: [...legacyBan, ...appPkgBan] }],
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      }],
      "@typescript-eslint/no-explicit-any": "warn",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
);
