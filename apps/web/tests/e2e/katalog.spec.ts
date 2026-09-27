import { test, expect } from "@playwright/test";
import { installMockDirectus, loginMock, waitForCaptchaForm } from "../fixtures/mock-directus.mjs";
import { PRODUK_ID } from "../fixtures/katalog-data.mjs";
import { USAHA_ID, createProgramState, installMockProgram, navigateSidebar } from "../fixtures/mock-program.mjs";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

test.describe("Modul 7.1 · Katalog", () => {
  test("public catalogue renders curated products with badges and filters on the server", async ({ page }) => {
    const state = createProgramState();
    await installMockDirectus(page);
    await installMockProgram(page, state);
    await page.goto("/katalog");

    const cards = page.getByTestId("product-card");
    await expect(cards).toHaveCount(2);
    await expect(page.getByTestId("katalog-total")).toHaveText("2");
    const keripik = cards.filter({ hasText: "Keripik Singkong Balado" });
    for (const badge of ["Rekomendasi", "Talent Jabar", "HALAL", "PIRT", "PDN", "Ramah Disabilitas"]) {
      await expect(keripik.getByText(badge, { exact: true })).toBeVisible();
    }
    await expect(keripik.getByText("Rp12.000 – Rp15.000")).toBeVisible();
    await expect(keripik.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", /^https:\/\/wa\.me\/6281234567890\?text=/);

    // The page is server-rendered; retry until hydration has attached the chip's click handler.
    await expect(async () => {
      await page.getByRole("button", { name: "Fashion", exact: true }).click();
      await expect(cards).toHaveCount(1, { timeout: 1000 });
    }).toPass({ timeout: 15_000 });
    await expect(cards.first()).toContainText("Batik Tulis Mega Mendung");
    const listRequest = state.requests.filter((request) => request.path === "/panel/items/produk" && !request.query?.aggregate).at(-1);
    expect(JSON.parse(listRequest!.query!.filter!)).toEqual({ _and: [{ kategori: { _eq: "fashion" } }] });
  });

  test("product detail shows specs and legal status and sends a letter of intent with a captcha", async ({ page }) => {
    const state = createProgramState();
    await installMockDirectus(page);
    await installMockProgram(page, state);
    await page.goto(`/katalog/${PRODUK_ID}`);

    await expect(page.getByRole("heading", { name: "Keripik Singkong Balado" })).toBeVisible();
    await expect(page.getByText("Halal: Terverifikasi")).toBeVisible();
    await expect(page.getByText("BPOM: Belum ada")).toBeVisible();
    await expect(page.getByText("PDN: Deklarasi mandiri")).toBeVisible();
    await expect(page.locator('iframe[src^="https://www.youtube-nocookie.com/embed/"]')).toBeAttached();
    await expect(page.getByText("85%")).toBeVisible();
    await waitForCaptchaForm(page);

    await page.getByLabel("Nama", { exact: true }).fill("Pembeli Grosir");
    await page.getByLabel("Email").fill("beli@contoh.id");
    await page.getByLabel("Perkiraan jumlah pesanan").fill("1.000 pcs");
    await page.getByLabel("Pesan", { exact: true }).fill("Kami tertarik untuk kerja sama.");
    await page.getByRole("button", { name: "Kirim LOI" }).click();

    await expect(page.getByText("Letter of Intent terkirim.")).toBeVisible({ timeout: 15_000 });
    expect(state.loi).toHaveLength(1);
    expect(state.loi[0]).toMatchObject({ produk: PRODUK_ID, nama: "Pembeli Grosir", email: "beli@contoh.id", jumlah: "1.000 pcs" });
    expect(state.loi[0].captcha).toBeTruthy();
  });

  test("an unpublished product is not found", async ({ page }) => {
    await installMockDirectus(page);
    await page.goto("/katalog/66666666-6666-4666-8666-000000000099");
    await expect(page.getByRole("heading", { name: "Produk tidak ditemukan" })).toBeVisible();
  });

  test("a business submits a product with photos in the public folder and a curator publishes it", async ({ page }) => {
    const state = createProgramState();
    await installMockDirectus(page, { authenticated: true });
    await installMockProgram(page, state);
    await loginMock(page, "/dashboard/usaha/produk");

    await page.getByLabel("Cari usaha").fill("Usaha 01");
    await page.getByRole("button", { name: "Cari" }).click();
    await page.getByRole("button", { name: "Kelola produk" }).click();
    await page.getByRole("button", { name: "Tambah Produk" }).click();

    await page.getByTestId("foto-produk-input").setInputFiles({ name: "produk.png", mimeType: "image/png", buffer: PNG });
    await expect(page.getByAltText("Foto produk 1")).toBeVisible();
    await page.getByLabel("Nama produk").fill("Keripik Pedas");
    await page.locator('select[name="kategori"]').selectOption("makanan");
    await page.getByLabel("Harga retail (Rp)").fill("15000");
    await page.getByLabel("TKDN (%)").fill("80");
    await page.getByRole("checkbox", { name: /deklarasi mandiri Produk Dalam Negeri/ }).click();
    await page.getByRole("button", { name: "Ajukan ke Kurasi" }).click();

    await expect(page.getByText("Produk diajukan ke kurasi DISKUK.")).toBeVisible();
    expect(state.uploadFolders).toEqual(["6f3c1a9e-2b7d-4e58-9a41-0d5e8c7b2f10"]);
    const created = state.requests.find((request) => request.method === "POST" && request.path === "/katalog/produk");
    expect(created?.body).toMatchObject({ usaha: USAHA_ID, nama: "Keripik Pedas", kategori: "makanan", hargaRetail: 15000, tkdnPersen: 80, pdnDeklarasi: true, foto: [state.uploads[0]] });

    await navigateSidebar(page, "Kurasi Katalog", "/dashboard/katalog/kurasi");
    await page.getByRole("button", { name: "Kurasi" }).click();
    await page.getByRole("button", { name: "Tolak" }).click();
    await expect(page.getByText("Tulis alasan penolakan untuk pelaku usaha.")).toBeVisible();
    await page.getByRole("button", { name: "Tayangkan" }).click();
    await expect(page.getByText("Keripik Pedas: Tayang.")).toBeVisible();
    expect(state.produk[0].statusKurasi).toBe("tayang");
  });
});
