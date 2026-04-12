import type { TerminalSnapshot } from "./types";

/** Mock session — 실제 PTY 연결 전 데모용. */
export const MOCK_TERMINAL: TerminalSnapshot = {
  activeSessionId: "zsh-1",
  sessions: [
    {
      id: "zsh-1",
      label: "zsh",
      promptHead: "~/quanta-ide  main ●",
      lines: [
        { id: "t-1", kind: "prompt", text: "pnpm dev" },
        { id: "t-2", kind: "system", text: "VITE v8.0.7  ready in 412 ms" },
        { id: "t-3", kind: "stdout", text: "  ➜  Local:   http://localhost:5173/ide/" },
        { id: "t-4", kind: "stdout", text: "  ➜  Network: use --host to expose" },
        { id: "t-5", kind: "stdout", text: "  ➜  press h + enter to show help" },
        { id: "t-6", kind: "system", text: "[vite] hmr update /src/features/ide-quanta-log/ui/QuantaLogList.tsx" },
        { id: "t-7", kind: "system", text: "[vite] hmr update /src/features/ide-problems/ui/ProblemsTab.tsx" },
        { id: "t-8", kind: "prompt", text: "pnpm typecheck" },
        { id: "t-9", kind: "stdout", text: "> quanta-ide@0.0.0 typecheck" },
        { id: "t-10", kind: "stdout", text: "> tsc -b" },
        { id: "t-11", kind: "system", text: "✓ no errors (1.24s)" },
        { id: "t-12", kind: "prompt", text: "pnpm test watcher" },
        { id: "t-13", kind: "stdout", text: " RUN  v4.1.4" },
        { id: "t-14", kind: "stderr", text: " FAIL  src/features/ide-watcher/WatcherSparkline.test.tsx" },
        { id: "t-15", kind: "stderr", text: "  × renders empty state › expected 'watching' to be in document" },
        { id: "t-16", kind: "system", text: "Test Files  1 failed · 6 passed (7)" },
      ],
    },
  ],
};
