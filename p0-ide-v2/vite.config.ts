import path from "path";
import os from "os";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { repoScannerPlugin } from "./vite-plugins/repo-scanner";
import { perfLoggerPlugin } from "./vite-plugins/perf-logger";
import { gitHistoryPlugin } from "./vite-plugins/git-history-plugin";

const isTauri = Boolean(process.env.TAURI_ENV_PLATFORM);

export default defineConfig({
  base: isTauri ? "/" : "/ide/",
  cacheDir: path.join(os.homedir(), ".cache", "quanta-ide", "vite", "p0-ide-v2"),
  // Boot-time repo scan default: monorepo root (parent of p0-ide-v2). Override with `VITE_REPO_SCAN_ROOT`.
  define: {
    __DEFAULT_REPO_SCAN_ROOT__: JSON.stringify(path.resolve(__dirname, "..")),
  },
  plugins: [react(), repoScannerPlugin(), perfLoggerPlugin(), gitHistoryPlugin()],
  resolve: {
    alias: {
      // libs — now workspace packages, resolved via repo-root `libs/*`. Vite
      // also picks these up through `node_modules/@quanta/*` symlinks created
      // by pnpm, but the explicit alias keeps HMR snappy and avoids a stat
      // round-trip on every module graph rebuild.
      "@quanta/domain-types": path.resolve(__dirname, "../libs/domain-types/src"),
      "@quanta/ui-kit": path.resolve(__dirname, "../libs/ui-kit/src"),
      "@quanta/shell-contract": path.resolve(__dirname, "../libs/shell-contract/src"),
      "@quanta/shell": path.resolve(__dirname, "../libs/shell/src"),
      "@quanta/canvas-engine": path.resolve(__dirname, "../libs/canvas-engine/src"),
      "@quanta/canvas-pixi": path.resolve(__dirname, "../libs/canvas-pixi/src"),
      "@quanta/canvas-worker": path.resolve(__dirname, "../libs/canvas-worker/src"),
      "@quanta/code-universe": path.resolve(__dirname, "../products/code-universe/src"),
      // app-* — still in p0-ide-v2/packages/ for now (product surfaces).
      // Will be folded into the new canvas-universe product or kept as
      // legacy surfaces; either way stays put through Phase 2.
      "@quanta/app-ide": path.resolve(__dirname, "packages/app-ide/src"),
      "@quanta/app-agent": path.resolve(__dirname, "packages/app-agent/src"),
      "@quanta/app-pr": path.resolve(__dirname, "packages/app-pr/src"),
      "@quanta/app-reviews": path.resolve(__dirname, "packages/app-reviews/src"),
      "@quanta/app-rules": path.resolve(__dirname, "packages/app-rules/src"),
      "@quanta/app-scenario": path.resolve(__dirname, "packages/app-scenario/src"),
      "@quanta/app-settings": path.resolve(__dirname, "packages/app-settings/src"),
      "@quanta/app-dashboard": path.resolve(__dirname, "packages/app-dashboard/src"),
      "@quanta/app-home": path.resolve(__dirname, "packages/app-home/src"),
      "@quanta/app-policy": path.resolve(__dirname, "packages/app-policy/src"),
      "@quanta/app-demo": path.resolve(__dirname, "packages/app-demo/src"),
      "@quanta/app-code-city": path.resolve(__dirname, "packages/app-code-city/src"),
      "@quanta/app-autopilot": path.resolve(__dirname, "packages/app-autopilot/src"),
    },
  },
  server: { port: 5174, strictPort: true },
});
