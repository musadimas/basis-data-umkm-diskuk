import { test, expect } from "@playwright/test";
import { installMockDirectus, loginMock } from "../fixtures/mock-directus.mjs";
import { USAHA_ID, createProgramState, installMockProgram } from "../fixtures/mock-program.mjs";

test.describe("Modul 4 · Talent Scouting", () => {
  test("tabular rows link to the talent submission form", async ({ page }) => {
    await installMockDirectus(page, { authenticated: true });
    await loginMock(page, "/dashboard/tabular");
    await page.getByRole("button", { name: "Aksi untuk Usaha 01" }).click();
    await expect(page.getByRole("menuitem", { name: "Ajukan ke Talent Scouting" })).toHaveAttribute(
      "href",
      `/dashboard/talent/ajukan/${USAHA_ID}`,
    );
  });

  test("submission shows masked SIDT data, saves Jabar fields and scores on the server", async ({ page }) => {
    const state = createProgramState();
    await installMockDirectus(page, { authenticated: true });
    await installMockProgram(page, state);
    await loginMock(page, `/dashboard/talent/ajukan/${USAHA_ID}`);

    await expect(page.getByRole("heading", { name: "Ajukan ke Talent Scouting" })).toBeVisible();
    await expect(page.getByText("************1234")).toBeVisible();
    await expect(page.getByText("Siti Aminah")).toBeVisible();

    await page.getByLabel("Kapasitas produksi per bulan").fill("500");
    await page.getByLabel("Satuan").fill("kg");
    await page.locator('select[name="kesiapan-bpom"]').selectOption("dalam_proses");
    await page.getByRole("checkbox", { name: "Sudah menerima pembayaran QRIS" }).click();
    await page.locator("#surat-komitmen").setInputFiles({ name: "surat.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") });
    await expect(page.getByText("surat.pdf")).toBeVisible();

    await page.getByRole("button", { name: "Hitung Skor" }).click();
    await expect(page.getByTestId("skor-total")).toHaveText("68,8");
    await expect(page.getByText("rubrik sementara")).toBeVisible();

    const created = state.requests.find((request) => request.method === "POST" && request.path === "/talent/pengajuan");
    expect(created?.body).toMatchObject({
      usaha: USAHA_ID,
      kapasitasProduksi: 500,
      satuan: "kg",
      kesiapanLegalitas: { bpom: "dalam_proses" },
      literasiQris: true,
      literasiPembukuanDigital: false,
      suratKomitmen: state.uploads[0],
    });
    expect(state.requests.some((request) => request.path.endsWith("/hitung-skor"))).toBe(true);
  });

  test("curation approves selected submissions with a Berita Acara", async ({ page }) => {
    const state = createProgramState();
    state.pengajuan.push({
      id: "22222222-2222-4222-8222-000000000009",
      usaha: USAHA_ID,
      status: "dinilai",
      kapasitasProduksi: 500,
      satuan: "kg",
      kesiapanLegalitas: {},
      literasiQris: true,
      literasiPembukuanDigital: false,
      suratKomitmen: null,
      skor: { finansial: 35, pasar: 100, legalitas: 60, sdm: 80, total: 68.75, rubrikVersi: "placeholder-v0" },
      dinilaiAt: "2026-09-26T00:00:00Z",
      catatan: null,
      beritaAcara: null,
      dateCreated: "2026-09-26T00:00:00Z",
      dateUpdated: "2026-09-26T00:00:00Z",
    });
    await installMockDirectus(page, { authenticated: true });
    await installMockProgram(page, state);
    await loginMock(page, "/dashboard/talent/kurasi");

    const issue = page.getByRole("button", { name: /Terbitkan Berita Acara/ });
    await expect(issue).toBeDisabled();
    await page.getByRole("checkbox", { name: "Pilih Usaha 01" }).click();
    await issue.click();
    await page.getByLabel("Catatan (opsional)").fill("Batch 1");
    await page.getByRole("button", { name: "Terbitkan", exact: true }).click();

    await expect(page.getByText("Berita Acara BA-TS/2026/0001 terbit. 1 usaha masuk Talent Pool.")).toBeVisible();
    const issued = state.requests.find((request) => request.method === "POST" && request.path === "/talent/berita-acara");
    expect(issued?.body).toEqual({ pengajuan: ["22222222-2222-4222-8222-000000000009"], catatan: "Batch 1" });
    await expect(page.getByText("Belum ada pengajuan dengan status ini.")).toBeVisible();
  });
});
