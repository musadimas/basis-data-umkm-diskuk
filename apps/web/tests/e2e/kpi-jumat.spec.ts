import { test, expect } from "@playwright/test";
import { installMockDirectus, loginMock } from "../fixtures/mock-directus.mjs";

// Kontrak Jumat/idempotency sisi browser: payload membawa waktu penciptaan
// (dikirimPada) + clientUuid; replay offline Jumat setelah Jumat sah.
test("M5-03 kontrak Jumat: Kamis 422, Jumat 201, replay idempoten 200", async ({ page }) => {
  await installMockDirectus(page, { authenticated: true, role: "umkm" });
  await loginMock(page, "/dashboard/usaha", "/dashboard/usaha");

  const jumatBody = {
    clientUuid: "d1000000-0000-4000-8000-000000000011",
    mingguKe: 6,
    omzet: 19000000,
    jumlahTransaksi: 42,
    buktiFileId: "44444444-4444-4444-8444-000000000001",
    catatanKendala: "Uji",
    dikirimPada: new Date("2026-10-02T05:00:00Z").toISOString(),
  };
  const kamisBody = { ...jumatBody, clientUuid: "d1000000-0000-4000-8000-000000000012", dikirimPada: new Date("2026-10-01T05:00:00Z").toISOString() };

  // SAFETY: fetch browser melewati page.route mock (page.request tidak).
  const post = (body: unknown) =>
    page.evaluate(async (b) => {
      const res = await fetch("/panel/operasional/laporan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(b),
      });
      return res.status;
    }, body);

  expect(await post(kamisBody)).toBe(422);
  expect([200, 201]).toContain(await post(jumatBody));
  expect(await post(jumatBody)).toBe(200);
});
