import { test, expect } from "@playwright/test";
import { installMockDirectus, loginMock } from "../fixtures/mock-directus.mjs";
import { PESERTA_ID, createProgramState, installMockProgram } from "../fixtures/mock-program.mjs";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

/** Jumat WIB terakhir (bukan masa depan), dalam jendela sinkron 7 hari server (M5-03). */
function jumatTerakhir(now = new Date()): Date {
  const hari = (d: Date) => new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jakarta", weekday: "short" }).format(d);
  let waktu = new Date(now.getTime() - 60_000);
  while (hari(waktu) !== "Fri") waktu = new Date(waktu.getTime() - 86_400_000);
  return waktu;
}

function laporan(mingguKe: number, realisasiOmzet: number, status: "menunggu" | "disetujui" | "ditolak") {
  return {
    id: `44444444-4444-4444-8444-00000000010${mingguKe}`,
    peserta: PESERTA_ID,
    mingguKe,
    target: 1000000,
    realisasiOmzet,
    jumlahTransaksi: 20,
    capaianPersen: Math.round((realisasiOmzet / 1000000) * 1000) / 10,
    kendala: mingguKe === 5 ? "Bahan baku naik" : null,
    bukti: ["00000000-0000-4000-8000-000000000077"],
    status,
    catatanPendamping: null,
    direviewAt: null,
    clientUuid: `55555555-5555-4555-8555-00000000000${mingguKe}`,
    dateCreated: "2026-09-20T00:00:00Z",
    dateUpdated: "2026-09-20T00:00:00Z",
  };
}

test.describe("Modul 5 · Monitoring KPI mingguan", () => {
  test("UMKM view queues a report offline and syncs it once the connection returns", async ({ page, context }) => {
    const state = createProgramState();
    const jumat = jumatTerakhir();
    await page.clock.setFixedTime(jumat);
    await installMockDirectus(page, { authenticated: true, role: "umkm" });
    await installMockProgram(page, state);
    await loginMock(page, "/dashboard/usaha");

    // The single participant opens directly in the phone view.
    await expect(page.getByTestId("phone-frame")).toBeVisible();
    await expect(page.getByText("Minggu ke-6 dari 12")).toBeVisible();
    await expect(page.getByTestId("target-mingguan")).toContainText("1.000.000");
    await expect(page.getByTestId("connectivity-banner")).toHaveText(/Terhubung — data waktu nyata/);

    await context.setOffline(true);
    await expect(page.getByTestId("connectivity-banner")).toHaveText(/Mode Offline Aktif/);

    await page.getByLabel("Omzet minggu ini (Rp)").fill("1120000");
    await page.getByLabel("Jumlah transaksi").fill("34");
    await page.getByTestId("galeri-input").setInputFiles({ name: "nota.png", mimeType: "image/png", buffer: PNG });
    await page.getByLabel("Kendala minggu ini").fill("Hujan deras");
    await page.getByRole("button", { name: "Kirim Laporan" }).click();

    await expect(page.getByText("antre dan akan dikirim saat terhubung")).toBeVisible();
    await expect(page.getByText("1 laporan menunggu sinkronisasi")).toBeVisible();
    expect(state.requests.filter((request) => request.path.endsWith("/laporan"))).toHaveLength(0);

    await context.setOffline(false);
    await expect(page.getByText("laporan menunggu sinkronisasi")).toHaveCount(0, { timeout: 10_000 });
    const posts = state.requests.filter((request) => request.method === "POST" && request.path === `/kpi/peserta/${PESERTA_ID}/laporan`);
    expect(posts).toHaveLength(1);
    expect(posts[0]!.body).toMatchObject({ mingguKe: 6, realisasiOmzet: 1120000, jumlahTransaksi: 34, kendala: "Hujan deras", bukti: [state.uploads[0]] });
    expect(posts[0]!.body.clientUuid).toMatch(/^[0-9a-f-]{36}$/);
    // The draft carries its device time so a Friday report stays valid when it syncs later.
    expect(posts[0]!.body.dibuatPada).toBe(jumat.toISOString());
    await expect(page.getByRole("region", { name: "Riwayat laporan" }).getByText("Minggu ke-6")).toBeVisible();
  });

  test("a new report outside Friday (WIB) is refused before it is queued", async ({ page }) => {
    const state = createProgramState();
    await page.clock.setFixedTime(new Date(jumatTerakhir().getTime() - 86_400_000));
    await installMockDirectus(page, { authenticated: true, role: "umkm" });
    await installMockProgram(page, state);
    await loginMock(page, "/dashboard/usaha");

    await expect(page.getByTestId("aturan-jumat")).toContainText("setiap hari Jumat (WIB)");
    await page.getByLabel("Omzet minggu ini (Rp)").fill("1120000");
    await page.getByLabel("Jumlah transaksi").fill("34");
    await page.getByTestId("galeri-input").setInputFiles({ name: "nota.png", mimeType: "image/png", buffer: PNG });
    await page.getByRole("button", { name: "Kirim Laporan" }).click();

    await expect(page.getByRole("alert")).toHaveText("Laporan mingguan hanya dapat dibuat pada hari Jumat (WIB).");
    await expect(page.getByText("laporan menunggu sinkronisasi")).toHaveCount(0);
    expect(state.requests.filter((request) => request.path.endsWith("/laporan"))).toHaveLength(0);
  });

  test("pendamping reviews evidence, must explain a rejection, and approves", async ({ page }) => {
    const state = createProgramState();
    state.laporan.push(laporan(5, 1120000, "menunggu"));
    await installMockDirectus(page, { authenticated: true });
    await installMockProgram(page, state);
    await page.route("**/panel/assets/**", (route) => route.fulfill({ status: 200, contentType: "image/png", body: PNG }));
    await loginMock(page, "/dashboard/pendampingan");

    await page.getByRole("button", { name: "Tinjau" }).click();
    await expect(page.getByTestId("capaian")).toHaveText("Capaian 112% dari Target");
    await expect(page.getByText("Bahan baku naik")).toBeVisible();
    await page.getByRole("button", { name: "Perbesar foto 1" }).click();
    await expect(page.getByAltText("Foto bukti ukuran penuh")).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Tolak & Minta Perbaikan Bukti" }).click();
    await expect(page.getByText("Tulis catatan perbaikan sebelum menolak laporan.")).toBeVisible();
    expect(state.requests.some((request) => request.path.endsWith("/review"))).toBe(false);

    await page.getByRole("button", { name: "Setujui & Verifikasi Laporan" }).click();
    await expect(page.getByText("minggu ke-5 disetujui")).toBeVisible();
    expect(state.laporan[0]!.status).toBe("disetujui");

    await page.getByRole("tab", { name: /Belum Mengirim/ }).click();
    await expect(page.getByText("Minggu ke-6 · Batch 2026-1")).toBeVisible();
  });

  test("pitching recommendation unlocks only after four approved weeks on target", async ({ page }) => {
    const state = createProgramState();
    for (const week of [1, 2, 3]) state.laporan.push(laporan(week, 1000000, "disetujui"));
    await installMockDirectus(page, { authenticated: true });
    await installMockProgram(page, state);
    await loginMock(page, `/dashboard/pendampingan/${PESERTA_ID}`);

    const checkbox = page.getByRole("checkbox", { name: "Rekomendasikan ke Talent Investment Day / Champion" });
    await expect(page.getByText("Rangkaian terbaru: 3 minggu")).toBeVisible();
    await expect(checkbox).toBeDisabled();

    // Client-side navigation back to the page refetches through the browser mock (a reload would SSR).
    state.laporan.push(laporan(4, 1500000, "disetujui"));
    await page.getByRole("link", { name: "Panel Pendampingan" }).first().click();
    await page.getByRole("tab", { name: /Belum Mengirim/ }).click();
    await page.getByRole("link", { name: "Tren" }).click();
    await expect(page.getByText("Rangkaian terbaru: 4 minggu")).toBeVisible();
    await expect(checkbox).toBeEnabled();
    await checkbox.click();
    await expect(checkbox).toBeChecked();
    expect(state.peserta[0]!.rekomendasiPitching).toBe(true);
  });

  test("BUG-012: antrean disetujui dipaging 25 baris per halaman", async ({ page }) => {
    const state = createProgramState();
    for (let n = 1; n <= 26; n += 1) {
      state.laporan.push({
        ...laporan(n, 1000000, "disetujui"),
        id: `44444444-4444-4444-8444-${String(n).padStart(12, "0")}`,
        clientUuid: `55555555-5555-4555-8555-${String(n).padStart(12, "0")}`,
      });
    }
    await installMockDirectus(page, { authenticated: true });
    await installMockProgram(page, state);
    await loginMock(page, "/dashboard/pendampingan");

    await page.getByRole("tab", { name: "Disetujui" }).click();
    await expect(page.getByTestId("pager-antrean")).toContainText("1–25 dari 26");
    await expect(page.locator("tbody tr")).toHaveCount(25);

    await page.getByRole("button", { name: "Berikutnya" }).click();
    await expect(page.getByTestId("pager-antrean")).toContainText("26–26 dari 26");
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Berikutnya" })).toBeDisabled();

    // Ganti tab lalu kembali: halaman direset ke 1 (R9).
    await page.getByRole("tab", { name: "Ditolak" }).click();
    await page.getByRole("tab", { name: "Disetujui" }).click();
    await expect(page.getByTestId("pager-antrean")).toContainText("1–25 dari 26");
  });

  test("BUG-013: laporan tanpa foto bukti meminta konfirmasi kedua", async ({ page }) => {
    const state = createProgramState();
    state.laporan.push({ ...laporan(5, 1120000, "menunggu"), bukti: [] });
    await installMockDirectus(page, { authenticated: true });
    await installMockProgram(page, state);
    await loginMock(page, "/dashboard/pendampingan");

    await page.getByRole("button", { name: "Tinjau" }).click();
    await expect(page.getByTestId("peringatan-tanpa-bukti")).toBeVisible();
    await page.getByRole("button", { name: "Setujui & Verifikasi Laporan" }).click();
    await expect(page.getByText("Tetap setujui tanpa foto bukti?")).toBeVisible();
    expect(state.requests.some((request) => request.path.endsWith("/review"))).toBe(false);

    await page.getByRole("button", { name: "Batal" }).click();
    await expect(page.getByRole("button", { name: "Setujui & Verifikasi Laporan" })).toBeVisible();

    await page.getByRole("button", { name: "Setujui & Verifikasi Laporan" }).click();
    await page.getByRole("button", { name: "Ya, setujui tanpa bukti" }).click();
    await expect(page.getByText("minggu ke-5 disetujui")).toBeVisible();
    expect(state.laporan[0]!.status).toBe("disetujui");
  });

  test("BUG-013: kegagalan menyimpan mempertahankan modal dan konfirmasi", async ({ page }) => {
    const state = createProgramState();
    state.laporan.push({ ...laporan(5, 1120000, "menunggu"), bukti: [] });
    await installMockDirectus(page, { authenticated: true });
    await installMockProgram(page, state);
    // Didaftarkan sesudah mock program supaya menang (Playwright memakai route terakhir).
    await page.route("**/panel/v1/program/kpi/laporan/*/review", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ errors: [{ message: "error", extensions: { code: "INTERNAL_SERVER_ERROR" } }] }),
      }),
    );
    await loginMock(page, "/dashboard/pendampingan");

    await page.getByRole("button", { name: "Tinjau" }).click();
    await page.getByRole("button", { name: "Setujui & Verifikasi Laporan" }).click();
    await page.getByRole("button", { name: "Ya, setujui tanpa bukti" }).click();
    await expect(page.getByText("Keputusan tidak dapat disimpan. Coba lagi.")).toBeVisible();
    await expect(page.getByText("Tetap setujui tanpa foto bukti?")).toBeVisible();
    await expect(page.getByTestId("capaian")).toBeVisible();
  });

  test("BUG-014: rangkaian terbaru yang ditolak menonaktifkan rekomendasi pitching", async ({ page }) => {
    const state = createProgramState();
    for (const week of [1, 2, 3, 4, 5, 6]) state.laporan.push(laporan(week, 1200000, "disetujui"));
    state.laporan.push(laporan(7, 1200000, "ditolak"));
    await installMockDirectus(page, { authenticated: true });
    await installMockProgram(page, state);
    await loginMock(page, `/dashboard/pendampingan/${PESERTA_ID}`);

    await expect(page.getByText("Rangkaian terbaru: 0 minggu")).toBeVisible();
    const checkbox = page.getByRole("checkbox", { name: "Rekomendasikan ke Talent Investment Day / Champion" });
    await expect(checkbox).toBeVisible();
    await expect(checkbox).toBeDisabled();
  });

  test("BUG-014: rekomendasi lama tetap tersimpan walau syarat tidak lagi terpenuhi", async ({ page }) => {
    const state = createProgramState();
    for (const week of [1, 2, 3, 4, 5, 6]) state.laporan.push(laporan(week, 1200000, "disetujui"));
    state.laporan.push(laporan(7, 1200000, "ditolak"));
    state.peserta[0]!.rekomendasiPitching = true;
    await installMockDirectus(page, { authenticated: true });
    await installMockProgram(page, state);
    await loginMock(page, `/dashboard/pendampingan/${PESERTA_ID}`);

    await expect(page.getByText("Syarat rekomendasi tidak lagi terpenuhi")).toBeVisible();
    const checkbox = page.getByRole("checkbox", { name: "Rekomendasikan ke Talent Investment Day / Champion" });
    await expect(checkbox).toBeChecked();
    await expect(checkbox).toBeEnabled();
  });
});
