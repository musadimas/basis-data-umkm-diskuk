import { test, expect } from "@playwright/test";
import { installMockDirectus } from "../fixtures/mock-directus.mjs";
import { PRODUK_ID } from "../fixtures/katalog-data.mjs";
import { installMockProgram } from "../fixtures/mock-program.mjs";
import { tungguHidrasi } from "../fixtures/kegiatan-data.mjs";

test.describe("Modul 7.2 & 7.4 · Kegiatan, FAQ & Hotline", () => {
  // Cakupan penuh agenda (filter server, CTA per status, pengingat) ada di tests/e2e/kegiatan.spec.ts;
  // di sini hanya asap portal: halaman merender kalender dan detail dari konten publik.
  test("the event calendar renders the four status groups and opens details", async ({ page }) => {
    await installMockDirectus(page);
    await installMockProgram(page);
    await page.goto("/kegiatan");
    await tungguHidrasi(page);

    await expect(page.getByTestId("status-berjalan")).toContainText("Pelatihan Pemasaran Digital");
    await expect(page.getByTestId("status-pendaftaran")).toContainText("Pameran Produk Unggulan");
    await expect(page.getByTestId("status-segera")).toContainText("Temu Bisnis Ekspor");
    await expect(page.getByTestId("status-selesai")).toContainText("Bazar Ramadan");

    await page.getByTestId("status-pendaftaran").getByRole("button", { name: /Pameran Produk Unggulan/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Wajib memiliki NIB", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Ramah disabilitas")).toBeVisible();
    await expect(dialog.getByTestId("cta-detail")).toBeDisabled();
  });

  test("the help page shows FAQ from Directus and the official hotline", async ({ page }) => {
    await installMockDirectus(page);
    await page.goto("/bantuan");
    await expect(page.getByText("Bagaimana cara mengajukan konsultasi?")).toBeVisible();
    await expect(page.getByText("Program UMKM Naik Kelas")).toHaveCount(0);
    const hotline = page.getByRole("region", { name: "Kontak resmi DISKUK" });
    await expect(hotline.getByText("Senin–Jumat 08.00–16.00 WIB")).toBeVisible();
    await expect(hotline.getByRole("link", { name: "Hubungi via WhatsApp" })).toHaveAttribute("href", /^https:\/\/wa\.me\/6281100000000/);
  });

  test("the product page shows the official sales contact", async ({ page }) => {
    await installMockDirectus(page);
    await installMockProgram(page);
    await page.goto(`/katalog/${PRODUK_ID}`);
    await expect(page.getByRole("region", { name: "Kontak resmi DISKUK" })).toContainText("022-0000000");
  });
});
