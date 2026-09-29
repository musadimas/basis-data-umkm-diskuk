import { test, expect } from "@playwright/test";
import { MOCK_USER, installMockDirectus, loginMock, waitForCaptchaForm } from "../fixtures/mock-directus.mjs";
import { createProgramState, installMockProgram } from "../fixtures/mock-program.mjs";

/** Next weekday at least `offset` days ahead (Jakarta ≈ UTC+7), as YYYY-MM-DD. */
function nextWeekday(offset: number) {
  const date = new Date(Date.now() + 7 * 3_600_000 + offset * 86_400_000);
  while ([0, 6].includes(date.getUTCDay())) date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

test.describe("Modul 7.3 · Klinik Konsultasi", () => {
  test("the public 4-step form books a slot and returns a ticket number", async ({ page }) => {
    const state = createProgramState();
    await installMockDirectus(page);
    await installMockProgram(page, state);
    await page.goto("/konsultasi");

    // Step 1 — an anonymous visitor types the business name (stored as unverified). Values typed
    // before hydration are dropped, so the whole step is retried until step 2 renders.
    await expect(async () => {
      await page.getByLabel("Nama usaha").fill("Warung Bu Siti");
      await page.getByLabel("Nama narahubung").fill("Siti");
      await page.getByLabel("Nomor WhatsApp").fill("0812345");
      await page.getByRole("button", { name: "Lanjut" }).click();
      await expect(page.getByRole("alert")).toContainText("nomor WhatsApp", { timeout: 1000 });
      await page.getByLabel("Nomor WhatsApp").fill("081234567890");
      await page.getByRole("button", { name: "Lanjut" }).click();
      await expect(page.getByLabel("Ceritakan permasalahan usaha Anda")).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 20_000 });

    // Step 2
    await page.getByRole("radio", { name: /Legalitas & Standardisasi Produk/ }).check();
    await page.getByLabel("Ceritakan permasalahan usaha Anda").fill("Kami butuh bantuan mengurus sertifikat halal dan PIRT.");
    await page.getByTestId("lampiran-input").setInputFiles({ name: "nib.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") });
    await expect(page.getByText("nib.pdf")).toBeVisible();
    await page.getByRole("button", { name: "Lanjut" }).click();

    // Step 3
    const tanggal = nextWeekday(2);
    await page.getByLabel("Tanggal (Senin–Jumat)").fill(tanggal);
    await expect(page.getByRole("radio", { name: /09:00/ })).toBeDisabled();
    await page.getByRole("radio", { name: "10:30" }).click();
    await page.getByRole("button", { name: "Lanjut" }).click();

    // Step 4
    await expect(page.getByText("Warung Bu Siti")).toBeVisible();
    await waitForCaptchaForm(page);
    await page.getByRole("button", { name: "Kirim Tiket" }).click();
    await expect(page.getByTestId("nomor-tiket")).toHaveText("KLN-2026-09-0042", { timeout: 15_000 });

    const sent = state.tiketForms[0];
    expect(sent.contentType).toMatch(/^multipart\/form-data; boundary=/);
    expect(sent.payload).toMatchObject({ namaUsaha: "Warung Bu Siti", namaKontak: "Siti", whatsapp: "081234567890", poli: 1, moda: "daring", tanggal, slot: "10:30", consent: true });
    expect(sent.captcha).toBeTruthy();
    expect(sent.files).toEqual(["nib.pdf"]);
  });

  test("staff move tickets on the kanban and record the session", async ({ page }) => {
    const state = createProgramState();
    state.tiket.push({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-000000000001", nomor: "KLN-2026-09-0001", usaha: null, namaUsaha: "Warung Bu Siti", namaKontak: "Siti",
      whatsapp: "081234567890", email: null, poli: 1, poliNama: "Poli Legalitas & Perizinan", deskripsi: "Butuh PIRT", moda: "daring",
      jadwalTanggal: nextWeekday(2), jadwalSlot: "10:30", prioritas: "normal", status: "masuk", pendamping: null, pendampingNama: null,
      linkMeet: null, diagnosis: {}, actionPlan: null, rujukan: [], catatan: null, lampiran: [], dateCreated: "2026-09-26T00:00:00Z", dateUpdated: "2026-09-26T00:00:00Z",
    });
    await installMockDirectus(page, { authenticated: true });
    await installMockProgram(page, state);
    await loginMock(page, "/dashboard/klinik");

    await expect(page.getByTestId("kolom-masuk")).toContainText("Warung Bu Siti");
    await page.getByRole("button", { name: "Pindahkan KLN-2026-09-0001 ke tahap berikutnya" }).click();
    await expect(page.getByTestId("kolom-dijadwalkan")).toContainText("Warung Bu Siti");

    await page.getByRole("button", { name: "Warung Bu Siti" }).click();
    await page.getByRole("button", { name: "Ambil tiket ini" }).click();
    await expect(page.getByText("Pendamping: Analis Provinsi")).toBeVisible();
    await page.getByLabel("Tautan rapat daring").fill("https://meet.example/klinik");
    await page.getByLabel("Legalitas", { exact: true }).fill("Belum memiliki PIRT");
    await page.getByLabel("Rencana aksi").fill("Daftar PIRT ke Dinkes");
    await page.getByRole("button", { name: "Program Bantuan Sarpras" }).click();
    await page.getByRole("button", { name: "Simpan" }).click();

    await expect.poll(() => state.tiket[0].rujukan).toEqual(["sarpras"]);
    const patches = state.requests.filter((request) => request.method === "PATCH");
    expect(patches.at(-1)!.body).toMatchObject({
      status: "dijadwalkan", linkMeet: "https://meet.example/klinik", actionPlan: "Daftar PIRT ke Dinkes",
      diagnosis: { legalitas: "Belum memiliki PIRT" }, rujukan: ["sarpras"],
    });
    expect(patches.some((request) => request.body.pendamping === MOCK_USER.id)).toBe(true);
  });
});
