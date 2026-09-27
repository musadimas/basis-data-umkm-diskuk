import { test, expect } from "@playwright/test";
import { installMockDirectus, loginMock } from "../fixtures/mock-directus.mjs";
import { PESERTA_ID, createProgramState, installMockProgram } from "../fixtures/mock-program.mjs";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

function laporan(mingguKe: number, realisasiOmzet: number, status: "menunggu" | "disetujui") {
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
    await installMockDirectus(page, { authenticated: true, role: "umkm" });
    await installMockProgram(page, state);
    await loginMock(page, "/dashboard/usaha");

    // The single participant opens directly in the phone view.
    await expect(page.getByTestId("phone-frame")).toBeVisible();
    await expect(page.getByText("Minggu ke-6 dari 12")).toBeVisible();
    await expect(page.getByTestId("target-mingguan")).toContainText("1.000.000");
    await expect(page.getByTestId("connectivity-banner")).toHaveText(/Terhubung - Data Real-Time/);

    await context.setOffline(true);
    await expect(page.getByTestId("connectivity-banner")).toHaveText(/Mode Offline Aktif/);

    await page.getByLabel("Omzet minggu ini (Rp)").fill("1120000");
    await page.getByLabel("Jumlah transaksi").fill("34");
    await page.getByTestId("galeri-input").setInputFiles({ name: "nota.png", mimeType: "image/png", buffer: PNG });
    await page.getByLabel("Kendala minggu ini").fill("Hujan deras");
    await page.getByRole("button", { name: "Kirim Laporan" }).click();

    await expect(page.getByText("disimpan di ponsel")).toBeVisible();
    await expect(page.getByText("1 laporan menunggu sinkronisasi")).toBeVisible();
    expect(state.requests.filter((request) => request.path.endsWith("/laporan"))).toHaveLength(0);

    await context.setOffline(false);
    await expect(page.getByText("laporan menunggu sinkronisasi")).toHaveCount(0, { timeout: 10_000 });
    const posts = state.requests.filter((request) => request.method === "POST" && request.path === `/kpi/peserta/${PESERTA_ID}/laporan`);
    expect(posts).toHaveLength(1);
    expect(posts[0]!.body).toMatchObject({ mingguKe: 6, realisasiOmzet: 1120000, jumlahTransaksi: 34, kendala: "Hujan deras", bukti: [state.uploads[0]] });
    expect(posts[0]!.body.clientUuid).toMatch(/^[0-9a-f-]{36}$/);
    await expect(page.getByRole("region", { name: "Riwayat laporan" }).getByText("Minggu ke-6")).toBeVisible();
  });

  test("pendamping reviews evidence, must explain a rejection, and approves", async ({ page }) => {
    const state = createProgramState();
    state.laporan.push(laporan(5, 1120000, "menunggu"));
    await installMockDirectus(page, { authenticated: true });
    await installMockProgram(page, state);
    await page.route("**/panel/assets/**", (route) => route.fulfill({ status: 200, contentType: "image/png", body: PNG }));
    await loginMock(page, "/dashboard/pendampingan");

    await page.getByRole("button", { name: "Review" }).click();
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

    const checkbox = page.getByRole("checkbox", { name: "Rekomendasikan untuk sesi pitching investor" });
    await expect(page.getByText("Rangkaian terpanjang: 3 minggu")).toBeVisible();
    await expect(checkbox).toBeDisabled();

    // Client-side navigation back to the page refetches through the browser mock (a reload would SSR).
    state.laporan.push(laporan(4, 1500000, "disetujui"));
    await page.getByRole("link", { name: "Panel Pendampingan" }).first().click();
    await page.getByRole("tab", { name: /Belum Mengirim/ }).click();
    await page.getByRole("link", { name: "Tren" }).click();
    await expect(page.getByText("Rangkaian terpanjang: 4 minggu")).toBeVisible();
    await expect(checkbox).toBeEnabled();
    await checkbox.click();
    await expect(checkbox).toBeChecked();
    expect(state.peserta[0]!.rekomendasiPitching).toBe(true);
  });
});
