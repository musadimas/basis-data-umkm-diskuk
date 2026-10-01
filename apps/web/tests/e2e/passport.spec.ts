import { test, expect } from "@playwright/test";
import { installMockDirectus, loginMock } from "../fixtures/mock-directus.mjs";
import { PASSPORT_KODE } from "../fixtures/katalog-data.mjs";
import { createProgramState, installMockProgram } from "../fixtures/mock-program.mjs";

test.describe("Modul 6 · Talent Passport", () => {
  test("a curator issues a passport with a downloadable QR code and radar", async ({ page }) => {
    const state = createProgramState();
    state.usaha.talentStatus = "talent_pool";
    await installMockDirectus(page, { authenticated: true });
    await installMockProgram(page, state);
    await loginMock(page, "/dashboard/usaha/passport");

    await page.getByLabel("Cari usaha").fill("Usaha 01");
    await page.getByRole("button", { name: "Cari" }).click();
    await page.getByRole("button", { name: "Buka passport" }).click();
    await page.getByRole("button", { name: "Terbitkan Talent Passport" }).click();

    await expect(page.getByText(`Talent Passport ${PASSPORT_KODE} diterbitkan.`)).toBeVisible();
    await expect(page.getByTestId("passport-kode")).toHaveText(PASSPORT_KODE);
    await expect(page.getByText("Talent Pool Jawa Barat")).toBeVisible();
    const qr = page.getByAltText(`QR verifikasi ${PASSPORT_KODE}`);
    await expect(qr).toHaveAttribute("src", /^data:image\/png;base64,/);
    await expect(page.getByRole("link", { name: "Unduh QR (PNG)" })).toHaveAttribute("download", `talent-passport-${PASSPORT_KODE}.png`);
    await expect(page.getByRole("img", { name: /Radar skor: Finansial 35, Pasar 100/ })).toBeVisible();
  });

  test("kurator mencabut passport lewat dialog yang tetap stabil saat proses dan gagal", async ({ page }) => {
    const state = createProgramState();
    state.usaha.talentStatus = "talent_pool";
    await installMockDirectus(page, { authenticated: true });
    await installMockProgram(page, state);
    await loginMock(page, "/dashboard/usaha/passport");

    // Masuk ke passport usaha lalu terbitkan (penerbitan pertama tanpa dialog).
    await page.getByLabel("Cari usaha").fill("Usaha 01");
    await page.getByRole("button", { name: "Cari" }).click();
    await page.getByRole("button", { name: "Buka passport" }).click();
    await page.getByRole("button", { name: "Terbitkan Talent Passport" }).click();
    await expect(page.getByText(`Talent Passport ${PASSPORT_KODE} diterbitkan.`)).toBeVisible();

    // Dialog terbitkan ulang memuat nama usaha dan bisa dibatalkan.
    await page.getByRole("button", { name: "Terbitkan ulang" }).click();
    const dialogUlang = page.getByRole("dialog");
    await expect(dialogUlang).toContainText(`Terbitkan ulang Talent Passport Usaha 01?`);
    await dialogUlang.getByRole("button", { name: "Batal" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // Jalur gagal: dialog tetap terbuka, galat inline, judul tetap varian "Cabut".
    state.gagalCabutPassport = true;
    await page.getByRole("button", { name: "Cabut passport" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(`Cabut Talent Passport ${PASSPORT_KODE}?`);
    await expect(dialog).toContainText("Usaha 01");
    await dialog.getByRole("button", { name: "Ya, cabut" }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("alert")).toHaveText("Talent Passport tidak dapat dicabut. Coba lagi.");
    await expect(dialog).toContainText(`Cabut Talent Passport ${PASSPORT_KODE}?`);

    // Jalur sukses (lambat): isi dialog tidak berganti selama proses, Esc diabaikan.
    state.gagalCabutPassport = false;
    state.tundaCabutPassport = true;
    await dialog.getByRole("button", { name: "Ya, cabut" }).click();
    const tombolProses = dialog.getByRole("button", { name: "Memproses…" });
    await expect(tombolProses).toBeVisible();
    await expect(tombolProses).toBeDisabled();
    await expect(dialog).toContainText(`Cabut Talent Passport ${PASSPORT_KODE}?`);
    await expect(dialog).not.toContainText("Terbitkan ulang Talent Passport");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();

    // Sukses menutup dialog dan menampilkan banner halaman.
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText(`Talent Passport ${PASSPORT_KODE} dicabut.`)).toBeVisible();

    // Dua POST cabut: satu gagal + satu sukses; guard sibuk mencegah request ganda.
    expect(state.requests.filter((request) => request.method === "POST" && /\/passport\/.+\/cabut$/.test(request.path)).length).toBe(2);
  });

  test("a business outside the talent pool cannot get a passport yet", async ({ page }) => {
    const state = createProgramState();
    await installMockDirectus(page, { authenticated: true });
    await installMockProgram(page, state);
    await loginMock(page, "/dashboard/usaha/passport");
    await page.getByLabel("Cari usaha").fill("Usaha 01");
    await page.getByRole("button", { name: "Cari" }).click();
    await page.getByRole("button", { name: "Buka passport" }).click();
    await expect(page.getByText("Usaha belum masuk Talent Pool.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Terbitkan Talent Passport" })).toBeDisabled();
  });

  test("the public page shows a verified passport and its portfolio tabs", async ({ page }) => {
    await installMockDirectus(page);
    await page.goto(`/passport/${PASSPORT_KODE.toLowerCase()}`);
    await expect(page.getByText("Terverifikasi: tanda tangan digital DISKUK Jawa Barat valid")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Keripik Siti" })).toBeVisible();
    // Y04: badge legalitas dirender sebagai chip Terverifikasi/Deklarasi dengan data-terverifikasi.
    await expect(page.getByTestId("badge-legalitas_halal")).toHaveAttribute("data-terverifikasi", "true");

    await expect(async () => {
      await page.getByRole("tab", { name: "Spesifikasi Teknis" }).click();
      await expect(page.getByText("20 x 10 x 5 cm")).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15_000 });
    await page.getByRole("tab", { name: "Video" }).click();
    await expect(page.locator('iframe[src^="https://www.youtube-nocookie.com/embed/"]')).toBeAttached();
  });

  test("a tampered or unknown passport is reported, not shown", async ({ page }) => {
    await installMockDirectus(page);
    await page.goto("/passport/TP0000000000");
    await expect(page.getByRole("heading", { name: "Talent Passport tidak valid" })).toBeVisible();
    await expect(page.getByText("Keripik Siti")).toHaveCount(0);
    await page.goto("/passport/TPZZZZZZZZZZ");
    await expect(page.getByRole("heading", { name: "Talent Passport tidak ditemukan" })).toBeVisible();
  });
});
