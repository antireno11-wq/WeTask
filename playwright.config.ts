import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { open: "never" }], ["list"]],
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    },
    {
      name: "mobile",
      use: { ...devices["iPhone 14"] }
    }
  ],

  // En CI levantamos el servidor antes de correr los tests
  webServer: process.env.CI
    ? {
        command: "npm run start",
        url: BASE_URL,
        reuseExistingServer: false,
        timeout: 120_000,
        env: {
          NODE_ENV: "production",
          SESSION_SECRET: process.env.SESSION_SECRET || "e2e-test-secret-32chars-minimum!",
          DATABASE_URL: process.env.DATABASE_URL || "",
          NEXT_PUBLIC_APP_URL: BASE_URL,
          APP_URL: BASE_URL,
          SEED_DEMO_DATA: "true"
        }
      }
    : undefined
});
