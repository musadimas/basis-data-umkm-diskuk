import { test, expect } from "@playwright/test";
import { keluarReal, loginReal } from "./real-login";

test("actual Directus session boundary", async ({ page }) => {
  test.skip(!process.env.PLAYWRIGHT_USE_REAL_API, "requires explicitly enabled ephemeral Directus stack");
  test.setTimeout(120_000);
  await loginReal(page, process.env.APPLICATION_USER_EMAIL || "", process.env.APPLICATION_USER_PASSWORD || "");
  expect((await page.request.get("/panel/v1/analytics/infographic/")).status()).toBe(200);
  await keluarReal(page);
});
