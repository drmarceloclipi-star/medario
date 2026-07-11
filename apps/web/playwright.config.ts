import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "on-first-retry",
  },
  webServer: {
    command:
      "npm run build && cp -r .next/static .next/standalone/apps/web/.next/static && PORT=3100 HOSTNAME=127.0.0.1 node .next/standalone/apps/web/server.js",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
  },
});
