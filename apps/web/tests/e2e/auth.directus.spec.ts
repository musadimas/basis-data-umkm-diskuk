import { test, expect } from "@playwright/test";
test("actual Directus session boundary", async ({ page }) => {
  test.skip(!process.env.PLAYWRIGHT_USE_REAL_API, "requires explicitly enabled ephemeral Directus stack");
  await page.goto("/sign-in"); await page.getByLabel("Email").fill(process.env.APPLICATION_USER_EMAIL || ""); await page.getByLabel("Kata sandi").fill(process.env.APPLICATION_USER_PASSWORD || ""); await page.getByRole("button", { name: "Masuk" }).click(); await expect(page).toHaveURL(/\/dashboard/);
  expect((await page.request.get("/panel/infografis/")).status()).toBe(200); await page.getByRole("button", { name: "Menu akun" }).click(); await page.getByText("Keluar").click(); await expect(page).toHaveURL(/\/sign-in/);
});
