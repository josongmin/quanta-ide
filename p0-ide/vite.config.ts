import path from "path";
import type { Connect } from "vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Tauri sets TAURI_ENV_PLATFORM at dev/build time.
const isTauri = !!process.env.TAURI_ENV_PLATFORM;

/** `/ide` without trailing slash 404s; send clients to `/ide/` (query preserved). */
function ideTrailingSlashRedirect(): Connect.NextHandleFunction {
  return (req, res, next) => {
    const url = req.url ?? "";
    if (url === "/ide") {
      res.statusCode = 302;
      res.setHeader("Location", "/ide/");
      res.end();
      return;
    }
    if (url.startsWith("/ide?")) {
      res.statusCode = 302;
      res.setHeader("Location", `/ide/?${url.slice(5)}`);
      res.end();
      return;
    }
    next();
  };
}

// Tauri loads from local files (base "/"); web deployment serves under "/ide/".
export default defineConfig({
  base: isTauri ? "/" : "/ide/",
  plugins: [
    react(),
    // Trailing-slash redirect is only needed for the web dev server, not Tauri.
    ...(!isTauri
      ? [
          {
            name: "ide-trailing-slash-redirect",
            configureServer(server: Parameters<NonNullable<import("vite").Plugin["configureServer"]>>[0]) {
              server.middlewares.use(ideTrailingSlashRedirect());
            },
            configurePreviewServer(server: Parameters<NonNullable<import("vite").Plugin["configurePreviewServer"]>>[0]) {
              server.middlewares.use(ideTrailingSlashRedirect());
            },
          },
        ]
      : []),
  ],
  // Avoid HMR churn when coverage HTML exists locally (gitignored but still watched).
  server: {
    port: 5173,
    // In Tauri mode port must match devUrl exactly; in web mode allow fallback.
    strictPort: isTauri,
    watch: {
      ignored: ["**/coverage/**", "**/dist/**"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@corpus": path.resolve(__dirname, "../demo-corpus/payments-api"),
      "@analysis": path.resolve(__dirname, "../demo-corpus/payments-api/.analysis/generated"),
    },
  },
  build: {
    // Skip gzip size reporting — lowers peak RSS during `vite build` (Rollup output walk).
    reportCompressedSize: false,
    target: "es2022",
    // IDE demo is a single large chunk by design; avoid noisy CI warnings until code-splitting.
    chunkSizeWarningLimit: 900,
  },
});
