import { defineConfig } from "@playwright/test";
import os from "node:os";
import path from "node:path";

const isCI = Boolean(process.env.CI);
const cacheRoot = path.join(os.homedir(), ".cache", "quanta-ide", "playwright");

export default defineConfig({
  testDir: "./e2e",
  // Per-test timeout. `gotoCanvas()` waits up to 90s for the Vite
  // cold-compile of the workspace chunk (pixi + canvas-engine is a
  // heavy import graph; 30-60s on a fresh dev-server spawn is
  // typical). The outer test timeout must be larger than that wait
  // or the test is killed before a legitimate cold boot completes.
  timeout: 120_000,
  retries: 1,
  outputDir: isCI ? "test-results" : path.join(cacheRoot, "test-results"),
  reporter: [
    [
      "html",
      {
        outputFolder: isCI ? "playwright-report" : path.join(cacheRoot, "report"),
        open: "never",
      },
    ],
  ],
  use: {
    baseURL: "http://localhost:5174",
    headless: true,
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "pnpm dev",
    port: 5174,
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
