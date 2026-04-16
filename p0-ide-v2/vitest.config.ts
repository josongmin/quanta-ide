import { defineConfig } from "vitest/config";
import path from "path";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@quanta/shell-contract": path.resolve(__dirname, "packages/shell-contract/src"),
      "@quanta/shell": path.resolve(__dirname, "packages/shell/src"),
      "@quanta/ui-kit": path.resolve(__dirname, "packages/ui-kit/src"),
      "@quanta/app-ide": path.resolve(__dirname, "packages/app-ide/src"),
      "@quanta/app-agent": path.resolve(__dirname, "packages/app-agent/src"),
      "@quanta/app-pr": path.resolve(__dirname, "packages/app-pr/src"),
      "@quanta/app-reviews": path.resolve(__dirname, "packages/app-reviews/src"),
      "@quanta/app-rules": path.resolve(__dirname, "packages/app-rules/src"),
      "@quanta/app-scenario": path.resolve(__dirname, "packages/app-scenario/src"),
      "@quanta/app-settings": path.resolve(__dirname, "packages/app-settings/src"),
      "@quanta/app-home": path.resolve(__dirname, "packages/app-home/src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["packages/*/src/**/*.test.{ts,tsx}", "src/**/*.test.{ts,tsx}"],
    css: true,
  },
});
