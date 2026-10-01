import { expect, test } from "@playwright/test";
import { installMockDirectus, loginMock } from "../fixtures/mock-directus.mjs";
import { createProgramState, installMockProgram } from "../fixtures/mock-program.mjs";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

test("N1-01: login menampilkan identitas DISKUK dan SIDT Jabar", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.getByAltText("Lambang Provinsi Jawa Barat dan logo DISKUK Jawa Barat")).toBeVisible();
  await expect(page.getByText("Portal Integrasi Satu Data · SIDT Jabar")).toBeVisible();
});

test("N2-01: lima aspek menampilkan numerator, total UMKM, dan data kosong", async ({ page }) => {
  await installMockDirectus(page, { role: "provinsi" });
  await page.route("**/panel/operasional/aspek-perkembangan*", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ data: { totalUsaha: 100, sumber: "Snapshot usaha_tabular, usaha, dan usaha_atribut_jabar", definisiVersi: "indikator-operasional-v3", kepatuhanRegulasi: false, aspek: [
      { id: "legalitas", label: "Legalitas dan formalitas", indikator: [{ id: "nib", label: "NIB tercatat", sumber: "usaha.nib", ya: 80, tidak: 0, diketahui: 80, belumAdaData: 20, total: 100, persentase: 80 }] },
      { id: "manajemen", label: "Manajemen dan tata kelola", indikator: [] },
      { id: "pemasaran", label: "Pemasaran dan digitalisasi", indikator: [] },
      { id: "keuangan", label: "Keuangan dan akses pembiayaan", indikator: [{ id: "akses_kur", label: "Akses KUR", sumber: "usaha_atribut_jabar.akses_kur", ya: 20, tidak: 10, diketahui: 30, belumAdaData: 70, total: 100, persentase: 20 }] },
      { id: "kemitraan", label: "Kemitraan dan jejaring", indikator: [] },
    ] } }),
  }));
  await loginMock(page);
  await expect(page.getByRole("heading", { name: "Lima aspek perkembangan usaha" })).toBeVisible();
  await page.getByRole("tab", { name: "Keuangan dan akses pembiayaan" }).click();
  await expect(page.getByLabel("Indikator perkembangan usaha").getByText("20%", { exact: true })).toBeVisible();
  await expect(page.getByText("70 belum ada data")).toBeVisible();
  await expect(page.locator('[role="tabpanel"]:visible').getByText("dari 100 UMKM")).toBeVisible();
  await expect(page.getByText("bukan skor resmi", { exact: false })).toBeVisible();
});

test("N5-01: toggle demo memakai outbox asli dan satu sinkronisasi", async ({ page }) => {
  test.skip(process.env.R01_DEMO_PREVIEW !== "1", "Perlu build dengan DEMO_MODE dan DEMO_DISPOSABLE aktif");
  const state = createProgramState();
  await installMockDirectus(page, { role: "umkm" });
  await installMockProgram(page, state);
  await loginMock(page, "/dashboard/usaha");
  await expect(page.getByTestId("demo-koneksi-toggle")).toBeVisible();
  await page.getByRole("button", { name: "Simulasikan offline" }).click();
  await expect(page.getByTestId("connectivity-banner")).toContainText("Simulasi Offline Aktif");
  await page.getByLabel("Omzet minggu ini (Rp)").fill("1120000");
  await page.getByLabel("Jumlah transaksi").fill("34");
  await page.getByTestId("galeri-input").setInputFiles({ name: "nota.png", mimeType: "image/png", buffer: PNG });
  await page.getByRole("button", { name: "Kirim Laporan" }).click();
  await expect(page.getByText("1 laporan menunggu sinkronisasi")).toBeVisible();
  expect(state.requests.filter((request) => request.method === "POST" && request.path.endsWith("/laporan"))).toHaveLength(0);
  await page.getByRole("button", { name: "Pulihkan koneksi simulasi" }).click();
  await expect(page.getByText("laporan menunggu sinkronisasi")).toHaveCount(0, { timeout: 10_000 });
  expect(state.requests.filter((request) => request.method === "POST" && request.path.endsWith("/laporan"))).toHaveLength(1);
});
