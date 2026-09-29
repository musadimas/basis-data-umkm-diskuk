import { test, expect } from "@playwright/test";
import { installMockDirectus, loginMock } from "../fixtures/mock-directus.mjs";
import { PASSPORT_KODE, PASSPORT_PAYLOAD, PNG_1PX } from "../fixtures/katalog-data.mjs";
import { USAHA_ID, createProgramState, installMockProgram } from "../fixtures/mock-program.mjs";
import { KURASI_FOLDER_ID } from "../../app/constants/PROGRAM";

const FOTO_BYTES = Buffer.from(PNG_1PX);

async function asRole(page: import("@playwright/test").Page, role: "umkm" | "provinsi") {
  // Same origin as the app under test (playwright.config baseURL); a cookie on any other port never
  // reaches the mocks, so every spec here silently ran as provinsi.
  await page.context().addCookies([{ name: "mock_role", value: role, url: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3100" }]);
}

test.describe("Modul 6 · Produk terkurasi & Talent Passport", () => {
  test("umkm submits a product with uji lab into the private curation folder, with the PMSE reminder", async ({ page }) => {
    const state = createProgramState();
    await installMockDirectus(page, { authenticated: true });
    await installMockProgram(page, state);
    await asRole(page, "umkm");
    await loginMock(page, "/dashboard/usaha/produk");
    await page.goto(`/dashboard/usaha/produk?usaha=${USAHA_ID}`);

    // Halaman dirender server-side; klik diulang sampai hidrasi memasang handler dan form terbuka.
    await expect(async () => {
      await page.getByRole("button", { name: "Tambah Produk" }).click();
      await expect(page.getByText("dilarang memanipulasi transaksi maupun ulasan")).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15_000 });
    await page.getByLabel("Nama produk").fill("Gantungan Kunci Kulit");
    await page.locator('input[data-testid="foto-produk-input"]').setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: FOTO_BYTES });
    await page.getByLabel("Sertifikasi uji lab").fill("Uji mikrobiologi labkes: aman");
    await page.getByRole("button", { name: "Ajukan ke Kurasi" }).click();
    await expect(page.getByText("Produk diajukan ke kurasi DISKUK.")).toBeVisible();
    await expect(page.getByText("Menunggu kurasi").first()).toBeVisible();

    const created = state.requests.find((request) => request.method === "POST" && request.path === "/katalog/produk");
    expect(created?.body).toMatchObject({ usaha: USAHA_ID, nama: "Gantungan Kunci Kulit", ujiLab: "Uji mikrobiologi labkes: aman" });
    // Photos wait in the curation folder, which has no public read grant (M6-04).
    expect(state.uploadFolders[0]).toBe(KURASI_FOLDER_ID);
  });

  test("photo upload stops at five with an explicit limit message", async ({ page }) => {
    const state = createProgramState();
    await installMockDirectus(page, { authenticated: true });
    await installMockProgram(page, state);
    await asRole(page, "umkm");
    await loginMock(page, "/dashboard/usaha/produk");
    await page.goto(`/dashboard/usaha/produk?usaha=${USAHA_ID}`);
    await expect(async () => {
      await page.getByRole("button", { name: "Tambah Produk" }).click();
      await expect(page.locator('input[data-testid="foto-produk-input"]')).toHaveCount(1, { timeout: 1000 });
    }).toPass({ timeout: 15_000 });

    const files = Array.from({ length: 6 }, () => ({ name: "foto.png", mimeType: "image/png", buffer: FOTO_BYTES }));
    await page.locator('input[data-testid="foto-produk-input"]').setInputFiles(files);
    await expect(page.getByText("Maksimal 5 foto per produk.")).toBeVisible();
    await expect(page.locator('input[data-testid="foto-produk-input"]')).toHaveCount(0);
    expect(state.uploads.length).toBe(5);
  });

  test("provinsi curates a product and the decision is read back", async ({ page }) => {
    const state = createProgramState();
    state.produk.push({
      id: "88888888-8888-4888-8888-000000000001", usaha: USAHA_ID, nama: "Gantungan Kunci Kulit", deskripsi: null,
      kategori: "kerajinan", kbli: null, hargaRetail: 25000, hargaGrosir: null, moq: null, videoUrl: null,
      dimensi: null, berat: null, shelfLife: null, bahanBaku: null, tkdnPersen: null, kapasitasBulanan: null,
      leadTime: null, ujiLab: null, persenBahanLokal: null, pdnDeklarasi: false, foto: ["77777777-7777-4777-8777-000000000001"],
      statusKurasi: "menunggu", catatanKurasi: null, dikurasiAt: null, usahaNama: "Usaha 01", usahaKota: "Kabupaten Bogor",
      dateCreated: new Date().toISOString(), dateUpdated: new Date().toISOString(),
    });
    await installMockDirectus(page, { authenticated: true });
    await installMockProgram(page, state);
    await asRole(page, "provinsi");
    await loginMock(page, "/dashboard/katalog/kurasi");

    await expect(page.getByText("Gantungan Kunci Kulit")).toBeVisible();
    await page.getByRole("button", { name: "Kurasi" }).click();
    await page.getByRole("button", { name: "Tayangkan", exact: true }).click();
    await expect(page.getByText("Gantungan Kunci Kulit: Tayang.")).toBeVisible();

    const decided = state.requests.find((request) => request.method === "POST" && request.path.endsWith("/kurasi"));
    expect(decided?.body).toMatchObject({ keputusan: "tayang" });
    expect(state.produk[0]?.statusKurasi).toBe("tayang");
    expect(state.produk[0]?.catatanKurasi).toBeNull();
  });

  test("passport shows badges with evidence, score sources and downloads the QR as PDF", async ({ page }) => {
    const state = createProgramState();
    state.passport = {
      id: "99999999-9999-4999-8999-000000000001", kode: PASSPORT_KODE, status: "aktif", statusBadge: PASSPORT_PAYLOAD.statusBadge,
      skor: PASSPORT_PAYLOAD.skor, payload: PASSPORT_PAYLOAD, diterbitkanAt: PASSPORT_PAYLOAD.diterbitkanAt,
    };
    await installMockDirectus(page, { authenticated: true });
    await installMockProgram(page, state);
    await asRole(page, "umkm");
    // Sekali navigasi lewat returnTo (termasuk query usaha) agar tidak ada goto ganda yang saling membatalkan.
    await loginMock(page, "/dashboard/usaha/passport?usaha=" + USAHA_ID, "/dashboard/usaha/passport");

    await expect(page.getByTestId("passport-kode")).toHaveText(PASSPORT_KODE);
    await expect(page.locator('img[alt="QR verifikasi ' + PASSPORT_KODE + '"]')).toBeVisible();
    // Deklarasi mandiri stays clearly separate from verified badges (M6-03).
    await expect(page.getByTestId("badge-pdn_deklarasi")).toHaveAttribute("data-terverifikasi", "false");
    await expect(page.getByTestId("badge-legalitas_halal")).toHaveAttribute("data-terverifikasi", "true");
    await expect(page.locator('[aria-label="Sumber skor"]')).toContainText("kinerja");

    const unduhan = page.waitForEvent("download");
    await page.getByTestId("unduh-qr-pdf").click();
    const file = await unduhan;
    expect(file.suggestedFilename()).toBe(`talent-passport-${PASSPORT_KODE}.pdf`);
    const path = await file.path();
    const head = (await import("node:fs/promises")).readFile;
    const bytes = await head(path!);
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect(bytes.toString("latin1").trimEnd().endsWith("%%EOF")).toBe(true);
    expect(bytes.length).toBeGreaterThan(600);
  });

  test("the public verification page validates a signed passport without login", async ({ page }) => {
    await installMockDirectus(page, { authenticated: false });
    await page.goto(`/passport/${PASSPORT_KODE}`);
    await expect(page.getByText("Tanda tangan digital DISKUK Jawa Barat valid")).toBeVisible();
    await expect(page.getByTestId("badge-legalitas_halal")).toBeVisible();
    // The showroom tab shows specs per product, including the lab summary (M6-04).
    // Tab hanya merespons setelah hidrasi; klik diulang sampai panel spesifikasi tampil.
    await expect(async () => {
      await page.getByRole("tab", { name: "Spesifikasi Teknis" }).click();
      await expect(page.getByText("Uji mikrobiologi labkes: aman")).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15_000 });
  });

  test("an unknown passport code reports not found", async ({ page }) => {
    await installMockDirectus(page, { authenticated: false });
    await page.goto("/passport/TP0000000000");
    await expect(page.getByText("Talent Passport tidak valid")).toBeVisible();
  });
});
