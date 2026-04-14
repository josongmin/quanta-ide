import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const isTauri = Boolean(process.env.TAURI_ENV_PLATFORM);

export default defineConfig({
  base: isTauri ? "/" : "/ide/",
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  server: { port: 5174, strictPort: true },
});
