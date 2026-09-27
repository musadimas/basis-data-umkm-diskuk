import { test, expect } from "@playwright/test";
import { installMockDirectus } from "../fixtures/mock-directus.mjs";
import { PRODUK_ID } from "../fixtures/katalog-data.mjs";
import { installMockProgram } from "../fixtures/mock-program.mjs";

test.describe("Modul 7.2 & 7.4 · Kegiatan, FAQ & Hotline", () => {
  test("the event calendar groups events by derived status and opens details", async ({ page }) => {
    await installMockDirectus(page);
    await page.goto("/kegiatan");

    await expect(page.getByTestId("status-berjalan")).toContainText("Pelatihan Pemasaran Digital");
    await expect(page.getByTestId("status-pendaftaran")).toContainText("Pameran Produk Unggulan");
    await expect(page.getByTestId("status-segera")).toContainText("Temu Bisnis Ekspor");
    await expect(page.getByTestId("status-selesai")).toContainText("Bazar Ramadan");

    // Filters are client-side; retry until hydration has attached them.
    await expect(async () => {
      await page.getByLabel("Metode").selectOption("luring");
      await expect(page.getByTestId("status-berjalan")).not.toContainText("Pelatihan Pemasaran Digital", { timeout: 1000 });
    }).toPass({ timeout: 15_000 });
    await expect(page.getByTestId("status-pendaftaran")).toContainText("Pameran Produk Unggulan");
    await page.getByRole("checkbox", { name: "Ramah disabilitas" }).click();
    await expect(page.getByTestId("status-selesai")).not.toContainText("Bazar Ramadan");

    await page.getByTestId("status-pendaftaran").getByRole("button", { name: /Pameran Produk Unggulan/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Memiliki NIB")).toBeVisible();
    await expect(dialog.getByText("Ramah disabilitas")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Daftar" })).toBeDisabled();
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
