import { expect, test } from "@playwright/test";
import { installMockDirectus } from "../fixtures/mock-directus.mjs";

// R03 · N7-03: halaman fasilitasi bantuan — delapan kartu, filter uang/barang/jasa,
// kuota tersisa, hitung mundur dari waktu server, CTA hanya ke kanal resmi (tanpa form fiktif).

test.beforeEach(async ({ page }) => {
  await installMockDirectus(page);
});

test("delapan kartu bantuan tampil dengan kuota, status dan CTA resmi", async ({ page }) => {
  await page.goto("/fasilitasi");
  await expect(page.getByTestId("kartu-penghargaan")).toBeVisible();
  for (const bentuk of ["penghargaan", "beasiswa", "operasional", "sarpras_produksi", "sarpras_pemasaran", "revitalisasi_gedung", "permodalan", "lainnya"]) {
    await expect(page.getByTestId(`kartu-${bentuk}`)).toBeVisible();
  }
  // Kuota dari sumber yang disetujui: 25 total, 10 terisi ⇒ sisa 15 (penghargaan).
  await expect(page.getByTestId("sisa-penghargaan")).toHaveText(/Sisa 15/);
  await expect(page.getByTestId("kartu-penghargaan")).toContainText("Kuota terisi 10/25");
  // Kartu kuota nol jujur: permodalan habis.
  await expect(page.getByTestId("sisa-permodalan")).toHaveText("Kuota habis");
  // CTA hanya kanal resmi + petunjuk; tidak ada form permohonan fiktif.
  await expect(page.getByTestId("cta-permodalan")).toHaveAttribute("href", "https://diskuk.jabarprov.go.id/bantuan");
  await expect(page.getByTestId("petunjuk-beasiswa")).toBeVisible();
  await expect(page.locator("form")).toHaveCount(0);
});

test("filter uang/barang/jasa memfilter kartu dari server", async ({ page }) => {
  await page.goto("/fasilitasi");
  await expect(page.getByTestId("kartu-permodalan")).toBeVisible();
  // Klik bisa mendarat sebelum hidrasi: ulang klik sampai kartu benar-benar terfilter.
  await expect(async () => {
    await page.getByTestId("filter-uang").click();
    await expect(page.getByTestId("kartu-sarpras_produksi")).toHaveCount(0, { timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  await expect(page.getByTestId("kartu-permodalan")).toBeVisible();
  await page.getByTestId("filter-barang").click();
  await expect(page.getByTestId("kartu-sarpras_produksi")).toBeVisible();
  await expect(page.getByTestId("kartu-beasiswa")).toHaveCount(0);
  await page.getByTestId("filter-jasa").click();
  await expect(page.getByTestId("kartu-penghargaan")).toBeVisible();
  await expect(page.getByTestId("kartu-operasional")).toHaveCount(0);
  await page.getByTestId("filter-semua").click();
  await expect(page.getByTestId("kartu-beasiswa")).toBeVisible();
});

test("hitung mundur mengikuti waktu server dan menutup jujur saat lewat", async ({ page }) => {
  await page.goto("/fasilitasi");
  // Countdown aktif untuk semua kartu dibuka (penghargaan tutup dalam 3 hari).
  await expect(page.getByTestId("mundur-penghargaan")).toContainText(/Tutup dalam [0-9]+ hari \d{2}:\d{2}:\d{2}/);
  await expect(page.getByTestId("status-penghargaan")).toHaveText("Pendaftaran dibuka");
  // Kartu yang lewat deadline jujur menutup tanpa countdown.
  await expect(page.getByTestId("mundur-permodalan")).toHaveCount(0);
  await expect(page.getByTestId("status-permodalan")).toHaveText("Pendaftaran ditutup");
});
