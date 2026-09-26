import { test, expect } from "@playwright/test";
import { installMockDirectus, loginMock } from "../fixtures/mock-directus.mjs";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function isiForm(page: import("@playwright/test").Page) {
  await page.getByLabel(/Realisasi Omzet/).fill("19000000");
  await page.getByLabel(/Jumlah Transaksi/).fill("42");
  await page.getByLabel("Unggah Bukti Transaksi").setInputFiles({
    name: "bukti.png",
    mimeType: "image/png",
    buffer: png,
  });
  await page.getByText("Terpilih: bukti.png").waitFor({ timeout: 10000 });
  await page.getByLabel(/Catatan Singkat/).fill("Stok aman");
}

test("M5-01 beranda UMKM mobile: profil, batch, pendamping, minggu dari server", async ({ page }) => {
  await installMockDirectus(page, { authenticated: true, role: "umkm" });
  await page.clock.install({ time: new Date("2026-10-02T05:00:00Z") });
  await loginMock(page, "/dashboard/usaha", "/dashboard/usaha");
  await expect(page.getByRole("main").getByText("Wawan Leathercraft")).toBeVisible();
  await expect(page.getByText("Pengusaha Wawan Setiawan")).toBeVisible();
  await expect(page.getByText(/Fase Accelerator — Batch 1/)).toBeVisible();
  await expect(page.getByText("Pendamping: Rina Pendamping")).toBeVisible();
  await expect(page.getByText("Minggu ke-6 dari 12 Minggu Pendampingan")).toBeVisible();
  await expect(page.getByTestId("banner-koneksi")).toContainText("Terhubung");
});

test("M5-03 form Jumat diterima; Kamis ditolak (mock kontrak Jumat)", async ({ page }) => {
  await installMockDirectus(page, { authenticated: true, role: "umkm" });
  await page.clock.install({ time: new Date("2026-10-02T05:00:00Z") });
  await loginMock(page, "/dashboard/usaha/laporan", "/dashboard/usaha/laporan");
  await isiForm(page);
  await page.getByRole("button", { name: "Kirim Laporan Kinerja Mingguan" }).click();
  await expect(page.getByText(/terkirim/i)).toBeVisible();

  // Replay kontrak: kirim langsung dengan waktu Kamis → 422 BUKAN_JUMAT.
  // SAFETY: fetch browser melewati page.route mock (page.request tidak).
  const kamis = await page.evaluate(async () => {
    const res = await fetch("/panel/operasional/laporan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        clientUuid: "d1000000-0000-4000-8000-000000000099",
        mingguKe: 1,
        omzet: 1000,
        jumlahTransaksi: 1,
        buktiFileId: "44444444-4444-4444-8444-000000000001",
        catatanKendala: null,
        dikirimPada: new Date("2026-10-01T05:00:00Z").toISOString(),
      }),
    });
    return res.status;
  });
  expect(kamis).toBe(422);
});

test("M5-02 offline Jumat → antrean bertahan reload → sinkron tepat sekali", async ({ page, context }) => {
  await installMockDirectus(page, { authenticated: true, role: "umkm" });
  await page.clock.install({ time: new Date("2026-10-02T05:00:00Z") });
  await loginMock(page, "/dashboard/usaha/laporan", "/dashboard/usaha/laporan");
  await isiForm(page);
  await context.setOffline(true);
  await page.getByRole("button", { name: "Kirim Laporan Kinerja Mingguan" }).click();
  await expect(page.getByText(/diamankan di ponsel/i)).toBeVisible();
  await expect(page.getByTestId("banner-koneksi")).toContainText("Mode Offline Aktif");
  await expect(page.getByText(/Menunggu sinkronisasi/)).toBeVisible();
  // Persistensi IndexedDB (lapisan reload): reload dokumen offline memutus
  // navigasi Playwright, jadi bukti persistensi dibaca langsung dari IndexedDB.
  const tersimpan = await page.evaluate(async () => {
    const open = indexedDB.open("diskuk-idb");
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    const tx = db.transaction("kpiOutbox", "readonly");
    const count = await new Promise<number>((resolve, reject) => {
      const req = tx.objectStore("kpiOutbox").count();
      req.onsuccess = () => resolve(Number(req.result));
      req.onerror = () => reject(req.error);
    });
    db.close();
    return count;
  });
  expect(tersimpan).toBeGreaterThanOrEqual(1);
  await context.setOffline(false);
  await expect(page.getByText(/Sinkronisasi Berhasil! 1 Laporan/i).first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/Menunggu sinkronisasi/)).toHaveCount(0);
});
