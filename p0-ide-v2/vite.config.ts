import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const isTauri = Boolean(process.env.TAURI_ENV_PLATFORM);

export default defineConfig({
  base: isTauri ? "/" : "/ide/",
  plugins: [react()],
  resolve: {
    alias: {
      "@quanta/ui-kit": path.resolve(__dirname, "packages/ui-kit/src"),
      "@quanta/shell-contract": path.resolve(__dirname, "packages/shell-contract/src"),
      "@quanta/shell": path.resolve(__dirname, "packages/shell/src"),
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
  server: { port: 5174, strictPort: true },
});
