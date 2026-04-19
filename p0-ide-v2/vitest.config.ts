import { defineConfig } from "vitest/config";
import path from "path";
import react from "@vitejs/plugin-react";

// One vitest config for the whole web workspace. Tests live in the
// legacy app-* packages (p0-ide-v2/packages/app-*) AND in the new libs
// (../libs/*). Alias map mirrors vite.config.ts so module resolution
// at test time matches production exactly.

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // libs — new location
      "@quanta/shell-contract": path.resolve(__dirname, "../libs/shell-contract/src"),
      "@quanta/shell": path.resolve(__dirname, "../libs/shell/src"),
      "@quanta/ui-kit": path.resolve(__dirname, "../libs/ui-kit/src"),
      "@quanta/canvas-engine": path.resolve(__dirname, "../libs/canvas-engine/src"),
      "@quanta/canvas-pixi": path.resolve(__dirname, "../libs/canvas-pixi/src"),
      "@quanta/canvas-worker": path.resolve(__dirname, "../libs/canvas-worker/src"),
      "@quanta/code-universe": path.resolve(__dirname, "../products/code-universe/src"),
      "@quanta/domain-types": path.resolve(__dirname, "../libs/domain-types/src"),
      // app-* — still inside p0-ide-v2/packages/ for now
      "@quanta/app-ide": path.resolve(__dirname, "packages/app-ide/src"),
      "@quanta/app-agent": path.resolve(__dirname, "packages/app-agent/src"),
      "@quanta/app-pr": path.resolve(__dirname, "packages/app-pr/src"),
      "@quanta/app-reviews": path.resolve(__dirname, "packages/app-reviews/src"),
      "@quanta/app-rules": path.resolve(__dirname, "packages/app-rules/src"),
      "@quanta/app-scenario": path.resolve(__dirname, "packages/app-scenario/src"),
      "@quanta/app-settings": path.resolve(__dirname, "packages/app-settings/src"),
      "@quanta/app-home": path.resolve(__dirname, "packages/app-home/src"),
      "@quanta/app-demo": path.resolve(__dirname, "packages/app-demo/src"),
      "@quanta/app-policy": path.resolve(__dirname, "packages/app-policy/src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: [
      "packages/*/src/**/*.test.{ts,tsx}",
      "src/**/*.test.{ts,tsx}",
      "../libs/*/src/**/*.test.{ts,tsx}",
      "../products/*/src/**/*.test.{ts,tsx}",
    ],
    css: true,
  },
});
