import type { OutputSnapshot } from "./types";

const now = Date.now();
const s = (off: number): number => now - off * 1000;

export const MOCK_OUTPUT: OutputSnapshot = {
  activeChannelId: "typescript",
  channels: [
    {
      id: "typescript",
      label: "TypeScript",
      lines: [
        { id: "o-ts-1", at: s(182), level: "info", text: "Initializing TS server..." },
        { id: "o-ts-2", at: s(181), level: "info", text: "Project loaded: tsconfig.json" },
        { id: "o-ts-3", at: s(180), level: "info", text: "Project loaded: tsconfig.node.json" },
        { id: "o-ts-4", at: s(92),  level: "warn", text: "File exceeds size limit: assets/demo-fixture.json (2.1 MB)" },
        { id: "o-ts-5", at: s(14),  level: "info", text: "TypeScript/5.7.2 — incremental compile ok in 214ms" },
      ],
    },
    {
      id: "eslint",
      label: "ESLint",
      lines: [
        { id: "o-es-1", at: s(120), level: "info", text: "ESLint started (flat config)" },
        { id: "o-es-2", at: s(88),  level: "warn", text: "eslint-plugin-import-x: 2 files skipped (no parser found)" },
        { id: "o-es-3", at: s(6),   level: "info", text: "Lint clean: 312 files, 0 errors, 0 warnings" },
      ],
    },
    {
      id: "vite",
      label: "Vite",
      lines: [
        { id: "o-v-1", at: s(222), level: "info", text: "vite v8.0.7 building client environment..." },
        { id: "o-v-2", at: s(213), level: "info", text: "transforming...305 modules" },
        { id: "o-v-3", at: s(210), level: "info", text: "✓ built in 184ms" },
        { id: "o-v-4", at: s(208), level: "warn", text: "Some chunks are larger than 900 kB after minification." },
      ],
    },
    {
      id: "pyright",
      label: "Pyright",
      lines: [
        { id: "o-py-1", at: s(162), level: "info", text: "Pyright language server 1.1.375 starting" },
        { id: "o-py-2", at: s(155), level: "error", text: "codegraph_agent/orchestrator.py:142:9 — reportArgumentType" },
        { id: "o-py-3", at: s(155), level: "error", text: "  Argument of type 'StrategyId | None' is not assignable to 'StrategyId'." },
        { id: "o-py-4", at: s(40),  level: "info", text: "Analysis complete: 1 error, 0 warnings, 0 information" },
      ],
    },
  ],
};
