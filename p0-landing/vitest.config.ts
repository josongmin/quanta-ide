/// <reference types="vitest/config" />
import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/test/**",
        "src/**/*.test.{ts,tsx}",
        "src/**/*.spec.{ts,tsx}",
        "src/vite-env.d.ts",
        "src/main.tsx",
        "src/**/index.ts",
        "src/shared/hooks/useInteractiveDots.ts",
        "src/shared/hooks/usePointerGlow.ts",
        "src/features/repo-modal/ui/CircuitCanvas.tsx",
        "src/widgets/backgrounds/ui/Backgrounds.tsx",
      ],
      thresholds: {
        statements: 85,
        branches: 70,
        functions: 90,
        lines: 88,
      },
    },
  },
});
