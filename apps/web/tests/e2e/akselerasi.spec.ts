import { test, expect } from "@playwright/test";
import { installMockDirectus, loginMock } from "../fixtures/mock-directus.mjs";

test("akselerasi provinsi: masuk accelerator + champion gate", async ({ page }) => {
  await installMockDirectus(page, { authenticated: true, role: "provinsi" });
  await loginMock(page, "/dashboard/akselerasi", "/dashboard/akselerasi");
  await expect(page.getByRole("heading", { name: "Program Akselerasi" })).toBeVisible();
  await page.getByRole("button", { name: "Masuk Accelerator" }).first().click();
  await page.getByLabel("Batch").selectOption({ index: 1 }).catch(() => {});
  await page.getByLabel("Pendamping").selectOption({ index: 1 }).catch(() => {});
  await expect(page.getByRole("dialog").first()).toBeVisible();
  // Champion disabled tanpa rekomendasi pada baris talent_lab.
  const champions = page.getByRole("button", { name: "Tetapkan Champion" });
  await expect(champions.nth(1)).toBeDisabled();
});
