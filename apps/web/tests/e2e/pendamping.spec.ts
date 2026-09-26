import { test, expect } from "@playwright/test";
import { installMockDirectus, loginMock } from "../fixtures/mock-directus.mjs";

test("M5-04/M5-05 pendamping: 3 binaan, verifikasi zoom + tolak/approve", async ({ page }) => {
  await installMockDirectus(page, { authenticated: true, role: "pendamping" });
  await loginMock(page, "/dashboard/binaan", "/dashboard/binaan");
  await expect(page.getByText("Wawan Leathercraft")).toBeVisible();
  await expect(page.getByText("Tahu Sumedang Bu Ika")).toBeVisible();
  await expect(page.getByText("Sambal Subang Mantap")).toBeVisible();

  await page.goto("/dashboard/binaan/verifikasi");
  await expect(page.getByRole("button", { name: "Menunggu Persetujuan" })).toBeVisible();
  await page.getByRole("button", { name: /Wawan Leathercraft/ }).click();
  await expect(page.getByText(/Capaian 116[,.]7% dari Target/)).toBeVisible();
  await page.getByRole("button", { name: "Perbesar" }).click();
  await expect(page.locator("img[alt='Bukti laporan']")).toHaveAttribute("style", /scale\(1\.5\)/);
  await page.getByRole("button", { name: /Tolak & Minta/ }).click();
  await expect(page.getByText(/minimal 3 karakter/)).toBeVisible();
});

test("M5-04 tiga filter + luar binaan tidak muncul; M5-06 tren + rekomendasi", async ({ page }) => {
  await installMockDirectus(page, { authenticated: true, role: "pendamping" });
  await loginMock(page, "/dashboard/binaan/verifikasi", "/dashboard/binaan/verifikasi");
  for (const label of ["Menunggu Persetujuan", "Telah Disetujui", "Belum Mengirimkan Laporan"]) {
    await page.getByRole("button", { name: label }).click();
    await expect(page.locator("ul li").first()).toBeVisible();
  }
  await expect(page.getByText("Kopi Gunung Garut")).toHaveCount(0);

  await page.goto("/dashboard/binaan/bbbbbbbb-bbbb-4bbb-8bbb-000000000001");
  await expect(page.locator("svg").first()).toBeVisible();
  await expect(page.locator("table.sr-only").first()).toContainText("18000000");
  const box = page.getByRole("checkbox", { name: /Rekomendasikan ke Talent Investment Day/ });
  await expect(box).toBeEnabled();
  await box.check();
  await expect(page.getByText(/Rekomendasi tersimpan|Rekomendasi dicabut/i)).toBeVisible();
});
