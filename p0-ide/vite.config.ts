import path from "path";
import type { Connect } from "vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

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

// SPA under `/ide/` (assets). Dev & preview: `/` → `/ide/`; `/ide` → `/ide/`.
export default defineConfig({
  base: "/ide/",
  plugins: [
    react(),
    {
      name: "ide-trailing-slash-redirect",
      configureServer(server) {
        server.middlewares.use(ideTrailingSlashRedirect());
      },
      configurePreviewServer(server) {
        server.middlewares.use(ideTrailingSlashRedirect());
      },
    },
  ],
  // Avoid HMR churn when coverage HTML exists locally (gitignored but still watched).
  server: {
    watch: {
      ignored: ["**/coverage/**", "**/dist/**"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
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
