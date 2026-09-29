import { expect, test, type Page } from "@playwright/test";
import { installMockDirectus } from "../fixtures/mock-directus.mjs";
import { REGISTRASI_IDS } from "../fixtures/registrasi-data.mjs";
import { tungguHidrasi } from "../fixtures/kegiatan-data.mjs";

// R03 · N7-01…N7-02: pendaftaran kegiatan internal dari agenda publik (prefill sesi
// pemilik, pakta bersyarat, aksesibilitas, consent, captcha) dan panel panitia
// (keputusan, tugas, e-pass QR, pindai idempoten, sertifikat, ekspor XLSX).
// Mock mengimpor aturan server yang sama sehingga alur browser tidak menyimpang.
// Satu halaman dipakai lintas peran: state mock per-install tetap utuh dan peran
// aktif ditukar lewat cookie `mock_role` seperti sesi berganti akun.

const URL_INTERNAL = `/kegiatan/${REGISTRASI_IDS.kegiatanInternal}`;
const URL_PAKTA = `/kegiatan/${REGISTRASI_IDS.kegiatanInternalPakta}`;
const BASE = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3100";

/**
 * Altcha dipasang auto="onsubmit": klik kirim pertama TIDAK mengirim — ia memicu
 * verifikasi PoW (sama seperti pola retry loginMock). Helper ini mengulang klik sampai
 * widget terverifikasi; klik berikutnya mengirim form dengan payload siap.
 */
async function picuCaptcha(page: import("@playwright/test").Page) {
  await expect(async () => {
    await page.getByTestId("tombol-daftar").click();
    const state = await page.evaluate(() => document.querySelector("altcha-widget .altcha")?.getAttribute("data-state") ?? "belum-ada");
    if (state !== "verified") throw new Error(`widget ${state}`);
  }).toPass({ timeout: 20_000 });
}

async function gantiPeran(page: Page, peran: string) {
  await page.context().addCookies([{ name: "mock_role", value: peran, url: BASE }]);
}

test("CTA agenda event internal membuka form di aplikasi, bukan URL eksternal", async ({ page }) => {
  await installMockDirectus(page);
  await page.goto("/kegiatan");
  await tungguHidrasi(page);
  const cta = page.getByTestId(`cta-${REGISTRASI_IDS.kegiatanInternal}`);
  await expect(cta).toBeVisible();
  await expect(cta).toHaveAttribute("href", URL_INTERNAL);
  await cta.click();
  await expect(page).toHaveURL(new RegExp(URL_INTERNAL));
  await expect(page.getByTestId("badge-internal")).toBeVisible();
  // Anonim ditawari masuk, bukan form.
  await expect(page.getByTestId("cta-masuk")).toBeVisible();
  await expect(page.getByTestId("form-pendaftaran")).toHaveCount(0);
});

test("umkm mendaftar: prefill terisi, consent wajib, sukses menunggu keputusan", async ({ page }) => {
  await installMockDirectus(page, { authenticated: true, role: "umkm" });
  await page.goto(URL_INTERNAL);
  await expect(page.getByTestId("form-pendaftaran")).toBeVisible();
  await expect(page.getByText("Wawan Leathercraft")).toBeVisible();
  await picuCaptcha(page);
  // Consent belum dicentang → server menolak; UI menampilkan pesan jujur.
  await expect(async () => {
    await page.getByTestId("tombol-daftar").click();
    await expect(page.getByTestId("error-pendaftaran")).toBeVisible({ timeout: 8_000 });
  }).toPass({ timeout: 30_000 });
  await page.getByTestId("input-consent").check();
  await page.getByTestId("tombol-daftar").click();
  await expect(page.getByTestId("status-pendaftaran")).toContainText("Menunggu keputusan panitia", { timeout: 10_000 });
  await expect(page.getByTestId("form-pendaftaran")).toHaveCount(0);
});

test("aksesibilitas dan pakta integritas bersyarat ditegakkan server", async ({ page }) => {
  await installMockDirectus(page, { authenticated: true, role: "umkm" });

  // Aksesibilitas: centang butuh dukungan tanpa mengisi kebutuhan → server menolak.
  await page.goto(URL_INTERNAL);
  await picuCaptcha(page);
  await expect(async () => {
    await page.getByTestId("input-disabilitas").check();
    await page.getByTestId("input-consent").check();
    await page.getByTestId("tombol-daftar").click();
    await expect(page.getByTestId("error-pendaftaran")).toContainText("kebutuhan aksesibilitas", { timeout: 8_000 });
  }).toPass({ timeout: 30_000 });
  // Setelah kebutuhan diisi, pendaftaran diterima server (event ini tanpa pakta).
  await page.getByTestId("input-aksesibilitas").fill("Jalur kursi roda ke ruang kelas");
  await page.getByTestId("tombol-daftar").click();
  await expect(page.getByTestId("status-pendaftaran")).toContainText("Menunggu keputusan panitia", { timeout: 10_000 });

  // Pakta: event berpakta menolak pendaftaran tanpa pakta integritas.
  await page.goto(URL_PAKTA);
  await picuCaptcha(page);
  await expect(async () => {
    await page.getByTestId("input-consent").check();
    await page.getByTestId("tombol-daftar").click();
    await expect(page.getByTestId("error-pendaftaran")).toContainText("Pakta integritas", { timeout: 8_000 });
  }).toPass({ timeout: 30_000 });
  await page.getByTestId("input-pakta").check();
  await page.getByTestId("tombol-daftar").click();
  await expect(page.getByTestId("status-pendaftaran")).toContainText("Menunggu keputusan panitia", { timeout: 10_000 });
});

test("panitia: keputusan → e-pass umkm, tugas, sertifikat terbit dan dicabut, XLSX", async ({ page }) => {
  await installMockDirectus(page, { authenticated: true, role: "umkm" });
  await page.goto(URL_INTERNAL);
  await picuCaptcha(page);
  await page.getByTestId("input-consent").check();
  await page.getByTestId("tombol-daftar").click();
  await expect(page.getByTestId("status-pendaftaran")).toContainText("Menunggu", { timeout: 12_000 });

  // Ganti peran ke panitia provinsi dalam state mock yang sama.
  await gantiPeran(page, "provinsi");
  await page.goto("/dashboard/kegiatan");
  const baris = page.getByTestId(/baris-/).first();
  await expect(baris).toContainText("Wawan Leathercraft");
  await baris.getByRole("button", { name: "Terima" }).click();
  await expect(page.getByTestId("pesan-panitia")).toContainText("tersimpan");

  // E-pass muncul untuk peserta diterima; QR terikat kegiatan+pendaftaran.
  await gantiPeran(page, "umkm");
  await page.goto(URL_INTERNAL);
  await expect(page.getByTestId("kartu-epass")).toBeVisible();
  await expect(page.getByTestId("status-pendaftaran")).toContainText("Diterima");
  const qr = await page.getByTestId("qr-epass").getAttribute("data-qr");
  expect(qr).toMatch(/^DISKUK-EPASS:/);

  // Tugas selesai → terbitkan sertifikat → kode tampil → cabut menghapus.
  await gantiPeran(page, "provinsi");
  await page.goto("/dashboard/kegiatan");
  await page.getByTestId(/tugas-/).first().click();
  await expect(page.getByTestId("pesan-panitia")).toContainText("selesai");
  await page.getByTestId(/terbit-/).first().click();
  await expect(page.getByTestId(/kode-/).first()).toHaveText(/^SKMOCK/);
  await page.getByTestId(/cabut-/).first().click();
  await expect(page.getByTestId(/kode-/)).toHaveCount(0);

  // Ekspor XLSX mengunduh berkas pendaftar.
  const unduhan = page.waitForEvent("download");
  await page.getByTestId("tombol-xlsx").click();
  const berkas = await unduhan;
  expect(berkas.suggestedFilename()).toMatch(/^pendaftar-.*\.xlsx$/);
});

test("pindai QR dua kali menghasilkan satu presensi (idempoten)", async ({ page }) => {
  await installMockDirectus(page, { authenticated: true, role: "umkm" });
  await page.goto(URL_INTERNAL);
  await picuCaptcha(page);
  await page.getByTestId("input-consent").check();
  await page.getByTestId("tombol-daftar").click();
  await expect(page.getByTestId("status-pendaftaran")).toContainText("Menunggu", { timeout: 12_000 });

  await gantiPeran(page, "provinsi");
  await page.goto("/dashboard/kegiatan");
  await page.getByRole("button", { name: "Terima" }).first().click();
  await expect(page.getByTestId("pesan-panitia")).toContainText("tersimpan");

  await gantiPeran(page, "umkm");
  await page.goto(URL_INTERNAL);
  const qr = await page.getByTestId("qr-epass").getAttribute("data-qr");
  expect(qr).toMatch(/^DISKUK-EPASS:/);

  await gantiPeran(page, "provinsi");
  await page.goto("/dashboard/kegiatan");
  // Klik sebelum hidrasi menjadi submit native; ulangi sampai handler Vue aktif.
  await expect(async () => {
    await page.getByTestId("input-qr").fill(qr!);
    await page.getByTestId("input-sesi").fill("1");
    await page.getByTestId("tombol-pindai").click();
    await expect(page.getByTestId("hasil-pindai")).toContainText("Hadir 1/4 sesi (25%)", { timeout: 5_000 });
  }).toPass({ timeout: 30_000 });
  await page.getByTestId("tombol-pindai").click();
  await expect(page.getByTestId("hasil-pindai")).toContainText("Hadir 1/4 sesi (25%)");
});

test("kuota penuh: pendaftar jatuh ke daftar tunggu", async ({ page }) => {
  await installMockDirectus(page, { authenticated: true, role: "umkm" });
  await page.goto(`/kegiatan/${REGISTRASI_IDS.kegiatanInternalPenuh}`);
  await picuCaptcha(page);
  await page.getByTestId("input-consent").check();
  await page.getByTestId("tombol-daftar").click();
  await expect(page.getByTestId("status-pendaftaran")).toContainText("Daftar tunggu", { timeout: 12_000 });
  await expect(page.getByTestId("blok-pendaftaran")).toContainText("Kuota penuh saat Anda mendaftar");
});
