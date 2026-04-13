import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import jsxA11y from "eslint-plugin-jsx-a11y";
import importX from "eslint-plugin-import-x";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist", "coverage"]),
  {
    linterOptions: {
      reportUnusedDisableDirectives: "error",
      reportUnusedInlineConfigs: "error",
    },
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: globals.node,
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
      react.configs.flat.recommended,
      react.configs.flat["jsx-runtime"],
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      jsxA11y.flatConfigs.strict,
      importX.flatConfigs.recommended,
      importX.flatConfigs.typescript,
    ],
    languageOptions: {
      ecmaVersion: 2024,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      react: { version: "detect" },
      "import-x/resolver": { typescript: true },
    },
    rules: {
      // --- TypeScript strict overrides ---
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: false } },
      ],
      "@typescript-eslint/restrict-template-expressions": [
        "error",
        { allowNumber: true, allowBoolean: true },
      ],
      "@typescript-eslint/switch-exhaustiveness-check": "error",

      // --- React (TS + automatic JSX runtime) ---
      "react/prop-types": "off",
      "react/jsx-boolean-value": ["error", "never"],
      "react/jsx-no-useless-fragment": "error",

      // --- Import hygiene ---
      "import-x/order": [
        "error",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
          ],
          "newlines-between": "never",
        },
      ],
      "import-x/no-duplicates": "error",
      "import-x/first": "error",
      "import-x/newline-after-import": "error",
      "import-x/no-useless-path-segments": "error",
      "import-x/no-cycle": ["error", { maxDepth: 12 }],


      // --- General quality ---
      "no-console": "error",
      eqeqeq: ["error", "always"],
      "no-implicit-coercion": "error",
      curly: ["error", "multi-line"],
    },
  },
  // --- FSD Layer boundaries ---
  {
    files: ["src/features/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features/*"],
              message:
                "Features must not import from other features. Move shared logic to @/shared/ or @/entities/.",
            },
            {
              group: ["@/widgets/*"],
              message:
                "Features must not import from widgets. Use @/shared/ or @/entities/ instead.",
            },
            {
              group: ["@/app/*"],
              message:
                "Features must not import from app layer.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/shared/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features/*"],
              message:
                "Shared layer must not import from features.",
            },
            {
              group: ["@/widgets/*"],
              message:
                "Shared layer must not import from widgets.",
            },
            {
              group: ["@/entities/*"],
              message:
                "Shared layer must not import from entities.",
            },
            {
              group: ["@/app/*"],
              message:
                "Shared layer must not import from app layer.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/entities/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features/*"],
              message:
                "Entities must not import from features.",
            },
            {
              group: ["@/widgets/*"],
              message:
                "Entities must not import from widgets.",
            },
            {
              group: ["@/app/*"],
              message:
                "Entities must not import from app layer.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}", "src/test/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
    },
  },
]);
