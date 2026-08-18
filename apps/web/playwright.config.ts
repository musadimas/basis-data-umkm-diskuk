import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3100";
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL, trace: "retain-on-failure", screenshot: "on", video: "retain-on-failure" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], timezoneId: "UTC" } },
    { name: "tablet", use: { ...devices["iPad Mini"], timezoneId: "America/Los_Angeles" } },
    { name: "mobile", use: { ...devices["iPhone 13"], timezoneId: "UTC" } },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : { command: "pnpm exec nuxt dev --host 127.0.0.1 --port 3100", url: baseURL, reuseExistingServer: !process.env.CI, timeout: 120_000 },
});
