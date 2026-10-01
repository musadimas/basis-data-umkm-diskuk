import { test, expect } from "@playwright/test";
import { installMockDirectus, loginMock, waitForHydration } from "../fixtures/mock-directus.mjs";
import { USAHA_ID, createProgramState, installMockProgram } from "../fixtures/mock-program.mjs";

const OUT_OF_SCOPE_ID = "00000000-0000-0000-0000-000000000099";

/** Baris pengajuan seed untuk panel kurasi; bentuknya sama dengan respons server. */
interface BarisPengajuan {
  id: string;
  usaha: string;
  status: string;
  kapasitasProduksi: number | null;
  satuan: string | null;
  kesiapanLegalitas: Record<string, string>;
  literasiQris: boolean;
  literasiPembukuanDigital: boolean;
  suratKomitmen: string | null;
  skor: { finansial: number; pasar: number; legalitas: number; sdm: number; total: number; rubrikVersi: string; rekomendasi: string } | null;
  dinilaiAt: string | null;
  catatan: string | null;
  alasanTolak: string | null;
  ditolakAt: string | null;
  beritaAcara: string | null;
  dateCreated: string;
  dateUpdated: string;
}

function pengajuan(overrides: Partial<BarisPengajuan>): BarisPengajuan {
  return {
    id: "22222222-2222-4222-8222-000000000009",
    usaha: USAHA_ID,
    status: "dinilai",
    kapasitasProduksi: 500,
    satuan: "kg",
    kesiapanLegalitas: {},
    literasiQris: true,
    literasiPembukuanDigital: false,
    suratKomitmen: null,
    skor: { finansial: 35, pasar: 100, legalitas: 60, sdm: 80, total: 68.75, rubrikVersi: "placeholder-v0", rekomendasi: "Dipertimbangkan" },
    dinilaiAt: "2026-09-26T00:00:00Z",
    catatan: null,
    alasanTolak: null,
    ditolakAt: null,
    beritaAcara: null,
    dateCreated: "2026-09-26T00:00:00Z",
    dateUpdated: "2026-09-26T00:00:00Z",
    ...overrides,
  };
}

test.describe("Modul 4 · Talent Scouting", () => {
  test("tabular rows link to the talent submission form and detail profile", async ({ page }) => {
    await installMockDirectus(page, { authenticated: true });
    await loginMock(page, "/dashboard/tabular");
    await page.getByRole("button", { name: "Aksi untuk Usaha 01" }).click();
    await expect(page.getByRole("menuitem", { name: "Lihat Profil UMKM" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Ajukan ke Talent Scouting" })).toHaveAttribute(
      "href",
      `/dashboard/talent/ajukan/${USAHA_ID}`,
    );
  });

  test("out-of-scope or inaccessible business shows error alert", async ({ page }) => {
    const state = createProgramState();
    await installMockDirectus(page, { authenticated: true });
    await installMockProgram(page, state);
    await loginMock(page, `/dashboard/talent/ajukan/${OUT_OF_SCOPE_ID}`);

    await expect(page.getByRole("alert")).toContainText("Data usaha tidak tersedia atau Anda tidak memiliki akses.");
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
    await page.getByRole("combobox", { name: /BPOM/ }).click();
    await page.getByRole("option", { name: "Dalam proses" }).click();
    await page.getByRole("checkbox", { name: "Sudah menerima pembayaran QRIS" }).click();
    await page.locator("#surat-komitmen").setInputFiles({ name: "surat.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") });
    await expect(page.getByText("surat.pdf")).toBeVisible();

    await page.getByRole("button", { name: "Hitung Skor" }).click();
    await expect(page.getByTestId("skor-total")).toHaveText("68,8");
    await expect(page.getByTestId("skor-rekomendasi")).toHaveText("Dipertimbangkan");
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

    // BUG-006: Hitung Skor tidak lagi mengajukan; status tetap Draft sampai "Ajukan ke Kurasi".
    await expect(page.getByText("Draft", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Ajukan ke Kurasi" }).click();
    await expect(page.getByText("Siap dikurasi", { exact: true })).toBeVisible();
    expect(state.requests.some((request) => request.method === "POST" && /\/talent\/pengajuan\/.+\/ajukan$/.test(request.path))).toBe(true);
    await expect(page.getByLabel("Kapasitas produksi per bulan")).toBeDisabled();
    await expect(page.getByRole("button", { name: "Simpan Draft" })).toHaveCount(0);
  });

  test("TS-15/TS-17: Hitung Skor tanpa kapasitas menampilkan pesan per field dan tidak memanggil server", async ({ page }) => {
    const state = createProgramState();
    await installMockDirectus(page, { authenticated: true });
    await installMockProgram(page, state);
    await loginMock(page, `/dashboard/talent/ajukan/${USAHA_ID}`);

    await page.getByLabel("Kapasitas produksi per bulan").fill("");
    await page.getByLabel("Satuan").fill("kg");
    await page.getByRole("button", { name: "Hitung Skor" }).click();

    await expect(page.getByText("Kapasitas produksi wajib diisi dan lebih dari 0.")).toBeVisible();
    await expect(page.getByLabel("Kapasitas produksi per bulan")).toHaveAttribute("aria-invalid", "true");
    expect(state.requests.some((request) => request.path.endsWith("/hitung-skor"))).toBe(false);
  });

  test("R5: mengubah isian setelah Hitung Skor menonaktifkan Ajukan", async ({ page }) => {
    const state = createProgramState();
    await installMockDirectus(page, { authenticated: true });
    await installMockProgram(page, state);
    await loginMock(page, `/dashboard/talent/ajukan/${USAHA_ID}`);

    await page.getByLabel("Kapasitas produksi per bulan").fill("500");
    await page.getByLabel("Satuan").fill("kg");
    await page.getByRole("button", { name: "Hitung Skor" }).click();
    await expect(page.getByTestId("skor-total")).toHaveText("68,8");
    await expect(page.getByRole("button", { name: "Ajukan ke Kurasi" })).toBeEnabled();

    await page.getByLabel("Kapasitas produksi per bulan").fill("600");
    await expect(page.getByRole("button", { name: "Ajukan ke Kurasi" })).toBeDisabled();
    await expect(page.getByText("Isian berubah sejak skor dihitung. Hitung ulang skor sebelum mengajukan.")).toBeVisible();
  });

  test("R6: klik ganda Ajukan hanya mengirim satu request", async ({ page }) => {
    const state = createProgramState();
    await installMockDirectus(page, { authenticated: true });
    await installMockProgram(page, state);
    await loginMock(page, `/dashboard/talent/ajukan/${USAHA_ID}`);

    await page.getByLabel("Kapasitas produksi per bulan").fill("500");
    await page.getByLabel("Satuan").fill("kg");
    await page.getByRole("button", { name: "Hitung Skor" }).click();
    await expect(page.getByTestId("skor-total")).toHaveText("68,8");

    await page.getByRole("button", { name: "Ajukan ke Kurasi" }).dblclick();
    await expect(page.getByText("Siap dikurasi", { exact: true })).toBeVisible();
    expect(state.requests.filter((request) => /\/talent\/pengajuan\/.+\/ajukan$/.test(request.path)).length).toBe(1);
  });

  test.describe("BUG-008 alasan tolak lintas zona waktu", () => {
    test.use({ timezoneId: "America/New_York" });

    test("pengajuan ditolak menampilkan alasan dan Ajukan ulang membuat draft terisi", async ({ page }) => {
      const state = createProgramState();
      state.pengajuan.push(pengajuan({
        id: "22222222-2222-4222-8222-000000000010",
        status: "ditolak",
        kapasitasProduksi: 300,
        satuan: "pcs",
        literasiQris: true,
        skor: null,
        dinilaiAt: null,
        alasanTolak: "Kapasitas belum stabil",
        ditolakAt: "2026-09-30T18:30:00Z",
        dateCreated: "2026-09-30T00:00:00Z",
        dateUpdated: "2026-09-30T00:00:00Z",
      }));
      await installMockDirectus(page, { authenticated: true });
      await installMockProgram(page, state);
      await loginMock(page, `/dashboard/talent/ajukan/${USAHA_ID}`);

      const alert = page.getByRole("alert");
      await expect(alert).toContainText("Kapasitas belum stabil");
      await expect(alert).toContainText("1 Okt 2026");
      await expect(page.getByLabel("Kapasitas produksi per bulan")).toHaveValue("300");
      await expect(page.getByLabel("Kapasitas produksi per bulan")).toBeDisabled();

      await page.getByRole("button", { name: "Ajukan ulang" }).click();
      await expect(page.getByLabel("Kapasitas produksi per bulan")).toBeEnabled();
      const created = state.requests.find((request) => request.method === "POST" && request.path === "/talent/pengajuan");
      expect(created?.body).toMatchObject({ kapasitasProduksi: 300, satuan: "pcs" });
    });
  });

  test("curation approves selected submissions with a Berita Acara for provinsi, while kabkota cannot issue BA", async ({ page }) => {
    const state = createProgramState();
    state.pengajuan.push(pengajuan({ id: "22222222-2222-4222-8222-000000000009" }));
    // First, test provincial admin can issue BA
    await installMockDirectus(page, { authenticated: true, role: "provinsi" });
    await installMockProgram(page, state);
    await loginMock(page, "/dashboard/talent/kurasi");

    const issue = page.getByRole("button", { name: /Terbitkan Berita Acara/ });
    await expect(issue).toBeVisible();
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

  test("kabkota role cannot see or use Berita Acara issuance button", async ({ page }) => {
    const state = createProgramState();
    state.pengajuan.push(pengajuan({ id: "22222222-2222-4222-8222-000000000009" }));
    await installMockDirectus(page, { authenticated: true, role: "kabkota" });
    await installMockProgram(page, state);
    await loginMock(page, "/dashboard/talent/kurasi");

    // Kabkota should see the submission list, but the issue button and checkboxes should NOT exist
    await expect(page.getByText("Usaha 01")).toBeVisible();
    await expect(page.getByRole("button", { name: /Terbitkan Berita Acara/ })).toHaveCount(0);
    await expect(page.getByRole("checkbox", { name: /Pilih/ })).toHaveCount(0);
  });

  test("kabkota tidak melihat Tolak", async ({ page }) => {
    const state = createProgramState();
    state.pengajuan.push(pengajuan({ id: "22222222-2222-4222-8222-000000000014" }));
    await installMockDirectus(page, { authenticated: true, role: "kabkota" });
    await installMockProgram(page, state);
    await loginMock(page, "/dashboard/talent/kurasi");

    await expect(page.getByText("Usaha 01")).toBeVisible();
    await expect(page.getByRole("button", { name: "Tolak" })).toHaveCount(0);
  });

  test("kurasi: Tolak hanya di Siap dikurasi, alasan wajib, gagal tetap di dialog, tab Ditolak menampilkan alasan terbaru", async ({ page }) => {
    const state = createProgramState();
    const DRAFT_ID = "22222222-2222-4222-8222-000000000011";
    const DINILAI_ID = "22222222-2222-4222-8222-000000000012";
    state.pengajuan.push(
      pengajuan({ id: DRAFT_ID, status: "draft", kapasitasProduksi: 100, literasiQris: false, skor: null, dinilaiAt: null, dateCreated: "2026-09-20T00:00:00Z", dateUpdated: "2026-09-20T00:00:00Z" }),
      pengajuan({ id: DINILAI_ID }),
    );
    await installMockDirectus(page, { authenticated: true, role: "provinsi" });
    await installMockProgram(page, state);
    await loginMock(page, "/dashboard/talent/kurasi");

    // BUG-007: tab Draft tanpa tombol Tolak.
    await page.getByRole("tab", { name: "Draft" }).click();
    await expect(page.getByText("Usaha 01")).toBeVisible();
    await expect(page.getByRole("button", { name: "Tolak" })).toHaveCount(0);

    // BUG-010: dialog tolak ber-alasan, tombol nonaktif sampai alasan diisi.
    await page.getByRole("tab", { name: "Siap dikurasi" }).click();
    await page.getByRole("button", { name: "Tolak" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const konfirmasi = dialog.getByRole("button", { name: "Tolak pengajuan" });
    await expect(konfirmasi).toBeDisabled();
    await dialog.getByLabel("Alasan penolakan (wajib)").fill("Kapasitas belum stabil");
    await expect(konfirmasi).toBeEnabled();

    // R4: kegagalan server tidak menutup dialog dan mempertahankan alasan.
    state.failNext[`/talent/pengajuan/${DINILAI_ID}/tolak`] = true;
    await konfirmasi.click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("alert")).toHaveText("Pengajuan tidak dapat ditolak. Coba lagi.");
    await expect(dialog.getByLabel("Alasan penolakan (wajib)")).toHaveValue("Kapasitas belum stabil");

    await konfirmasi.click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText("Pengajuan Usaha 01 ditolak.")).toBeVisible();

    // BUG-008: alasan tampil di tab Ditolak.
    await page.getByRole("tab", { name: "Ditolak" }).click();
    await expect(page.getByText("Alasan: Kapasitas belum stabil")).toBeVisible();

    // BUG-009: penolakan lama tidak tampil lagi setelah ada pengajuan lebih baru untuk usaha yang sama.
    state.pengajuan.push(pengajuan({ id: "22222222-2222-4222-8222-000000000013", status: "disetujui", dinilaiAt: "2026-10-02T00:00:00Z", dateCreated: "2026-10-02T00:00:00Z", dateUpdated: "2026-10-02T00:00:00Z" }));
    await page.reload();
    // A full reload is server-rendered; wait for Vue listeners before switching the tab.
    await waitForHydration(page);
    await page.getByRole("tab", { name: "Ditolak" }).click();
    await expect(page.getByText("Belum ada pengajuan dengan status ini.")).toBeVisible();
  });

  test("R12: pindah usaha lewat navigasi klien me-remount form", async ({ page }) => {
    const state = createProgramState();
    await installMockDirectus(page, { authenticated: true });
    await installMockProgram(page, state);
    await loginMock(page, `/dashboard/talent/ajukan/${USAHA_ID}`);

    await page.getByLabel("Kapasitas produksi per bulan").fill("777");
    let loads = 0;
    page.on("load", () => {
      loads += 1;
    });
    await page.evaluate((path) => {
      history.pushState({}, "", path);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }, `/dashboard/talent/ajukan/${OUT_OF_SCOPE_ID}`);

    await expect(page.getByRole("alert")).toContainText("Data usaha tidak tersedia");
    await expect(page.getByLabel("Kapasitas produksi per bulan")).toHaveCount(0);
    expect(page.url()).toContain("000000000099");
    expect(loads).toBe(0);
  });
});
