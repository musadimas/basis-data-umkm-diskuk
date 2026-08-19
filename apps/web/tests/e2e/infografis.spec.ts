import { test, expect } from "@playwright/test";
import { installMockDirectus, loginMock } from "../fixtures/mock-directus.mjs";

test("infografis renders NIB and marketing cards below the sector chart", async ({ page }) => {
  await installMockDirectus(page, { authenticated: true });
  await loginMock(page, "/dashboard");

  await expect(
    page.getByRole("heading", { name: "Jumlah UMKM Berdasarkan Kategori Lapangan Usaha" }),
  ).toBeVisible();
  await expect(page.getByText("Kepemilikan NIB")).toBeVisible();
  await expect(page.getByText("Memiliki NIB", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /^Metode Pemasaran/ }),
  ).toBeVisible();
  await expect(page.getByTitle("Non-digital", { exact: true })).toBeVisible();
});
