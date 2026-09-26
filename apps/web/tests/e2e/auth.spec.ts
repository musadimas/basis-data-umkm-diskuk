import { test, expect } from "@playwright/test";
import { installMockDirectus, waitForCaptchaForm } from "../fixtures/mock-directus.mjs";
test.describe("private dashboard boundary", () => {
  test("anonymous dashboard redirects without loading dashboard API", async ({ page }) => {
    const requests: string[] = []; page.on("request", (request) => requests.push(request.url())); await installMockDirectus(page);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/sign-in\?returnTo=(?:%2F|\/)dashboard/);
    expect(requests.some((url) => /panel\/v1\/analytics\//.test(url))).toBe(false);
    await expect(page.getByRole("heading", { name: "Masuk ke Dashboard UMKM" })).toBeVisible();
    await expect(page.getByText("Daftar")).toHaveCount(0);
  });
  test("login reaches the requested dashboard path", async ({ page }) => {
    await installMockDirectus(page); await page.goto("/sign-in?returnTo=/dashboard"); await waitForCaptchaForm(page);
    await page.getByLabel("Email").fill("analyst@example.invalid"); await page.getByRole("textbox", { name: "Kata sandi" }).fill("not-a-real-secret"); await page.getByRole("button", { name: "Masuk" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});
