import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests/real",
  timeout: 120_000,
  workers: 1,
  fullyParallel: false,
  reporter: [["list"]],
  outputDir: "test-results-y49",
  use: { baseURL: "http://127.0.0.1:3255", trace: "off", screenshot: "off" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], timezoneId: "UTC" } }],
});
