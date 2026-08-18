import { test, expect } from "@playwright/test";
import { installMockDirectus, loginMock } from "../fixtures/mock-directus.mjs";
test("current-state dashboard does not present unvalidated workforce metric", async ({ page }) => {
  await installMockDirectus(page, { authenticated: true });
  await loginMock(page,"/dashboard");
  await expect(page.getByText("Skala yang dilaporkan")).toBeVisible();
  await expect(page.getByText("Persentase Tenaga Kerja Berdasarkan Gender")).toHaveCount(0);
});
