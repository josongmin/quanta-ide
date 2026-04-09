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
  build: {
    // Skip gzip size reporting — lowers peak RSS during `vite build` (Rollup output walk).
    reportCompressedSize: false,
    target: "es2022",
  },
});
