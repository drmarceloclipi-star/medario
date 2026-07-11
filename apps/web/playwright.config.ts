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
      "MEDARIO_PUBLIC_PROFILE_SOURCE=fixture npm run build && MEDARIO_PUBLIC_PROFILE_SOURCE=fixture PORT=3100 HOSTNAME=127.0.0.1 npm run start",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
  },
});
