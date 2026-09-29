import { test, expect } from "@playwright/test";
import { MOCK_USER, installMockDirectus, loginMock, waitForCaptchaForm } from "../fixtures/mock-directus.mjs";
import { VERSI_AWAL, createProgramState, installMockProgram } from "../fixtures/mock-program.mjs";

/** Next weekday at least `offset` days ahead (Jakarta ≈ UTC+7), as YYYY-MM-DD. */
function nextWeekday(offset: number) {
  const date = new Date(Date.now() + 7 * 3_600_000 + offset * 86_400_000);
  while ([0, 6].includes(date.getUTCDay())) date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

/** A ticket as `GET /v1/program/klinik/tiket` returns it to clinic staff. */
function tiketFixture(overrides = {}) {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-000000000001",
    nomor: "KLN-2026-09-0001",
    usaha: null,
    namaUsaha: "Warung Bu Siti",
    namaKontak: "Siti",
    whatsapp: "081234567890",
    email: null,
    poli: 4,
    poliNama: "Advokasi & Mediasi PMSE",
    deskripsi: "Akun marketplace kami dibekukan tanpa alasan.",
    moda: "daring",
    jadwalTanggal: nextWeekday(2),
    jadwalSlot: "10:30",
    prioritas: "mendesak",
    status: "masuk",
    pendamping: null,
    pendampingNama: null,
    pemohon: null,
    sumberIdentitas: "manual",
    waConsent: true,
    linkMeet: null,
    diagnosis: {},
    actionPlan: null,
    rujukan: [],
    catatan: null,
    lampiran: [],
    notifikasi: { status: "pending", label: "Menunggu dikirim", jenis: "tiket_dibuat", template: "klinik_tiket_dibuat", attempts: 0, lastError: null },
    pmseMendesak: true,
    versi: VERSI_AWAL,
    riwayat: [],
    dateCreated: "2026-09-26T00:00:00Z",
    dateUpdated: "2026-09-26T00:00:00Z",
    ...overrides,
  };
}

/**
 * Fills step 1 and moves on. Values typed before hydration are dropped with the listeners, so the
 * whole step is retried until the next step actually renders.
 */
async function isiLangkahSatu(page, { namaUsaha = "Warung Bu Siti", kontak = "Siti", whatsapp = "081234567890" } = {}) {
  await expect(async () => {
    await page.getByLabel("Nama usaha").fill(namaUsaha);
    await page.getByLabel("Nama narahubung").fill(kontak);
    await page.getByLabel("Nomor WhatsApp").fill(whatsapp);
    await page.getByRole("button", { name: "Lanjut" }).click();
    await expect(page.getByLabel("Ceritakan permasalahan usaha Anda")).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 20_000 });
}

test.describe("Y09 · Klinik publik dan panel petugas", () => {
  test("the landing lists the six desks and the ticket can be read back with its WhatsApp number", async ({ page }) => {
    const state = createProgramState();
    await installMockDirectus(page);
    await installMockProgram(page, state);
    await page.goto("/konsultasi");

    // Landing: six desks, each with its editable topics, before the form.
    await expect(page.getByTestId("poli-kartu")).toHaveCount(6);
    await expect(page.getByTestId("daftar-poli")).toContainText("Advokasi & Mediasi PMSE");
    await expect(page.getByTestId("daftar-poli")).toContainText("Inklusif & Disabilitas");
    await expect(page.getByTestId("daftar-poli")).toContainText("Pemulihan akun");

    // The form itself is one tab away and still walks the four steps.
    const tanggal = nextWeekday(2);
    await isiLangkahSatu(page);
    await page.getByRole("radio", { name: /Legalitas & Standardisasi Produk/ }).check();
    await page.getByLabel("Ceritakan permasalahan usaha Anda").fill("Kami butuh bantuan mengurus sertifikat halal dan PIRT.");
    await page.getByRole("button", { name: "Lanjut" }).click();
    await page.getByLabel("Tanggal (Senin–Jumat)").fill(tanggal);
    await page.getByRole("radio", { name: "10:30" }).click();
    await page.getByRole("button", { name: "Lanjut" }).click();
    await waitForCaptchaForm(page);
    await page.getByRole("button", { name: "Kirim Tiket" }).click();
    await expect(page.getByTestId("nomor-tiket")).toHaveText("KLN-2026-09-0042", { timeout: 15_000 });

    // The notification banner reports the outbox state, never "delivered" while no gateway is wired.
    await expect(page.getByTestId("status-notifikasi")).toContainText("Menunggu dikirim");
    await expect(page.getByText("Usaha ini dicatat sebagai belum terverifikasi", { exact: false })).toBeVisible();

    // Read-back: the number plus the booking WhatsApp number answers with the current status.
    await page.getByRole("button", { name: "Lacak status tiket" }).click();
    await expect(page.getByRole("region", { name: "Lacak tiket konsultasi" })).toBeVisible();
    await expect(async () => {
      await page.getByLabel("Nomor tiket").fill("KLN-2026-09-0042");
      await page.getByLabel("Nomor WhatsApp").fill("081234567890");
      await page.getByRole("button", { name: "Lacak" }).click();
      await expect(page.getByTestId("hasil-lacak")).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 20_000 });
    await waitForCaptchaForm(page);
    await expect(page.getByTestId("hasil-lacak")).toContainText("Tiket Masuk");
    await expect(page.getByTestId("hasil-lacak")).toContainText("Menunggu dikirim");

    // A wrong number is refused without revealing whether the ticket exists.
    await expect(async () => {
      await page.getByLabel("Nomor WhatsApp").fill("081200000000");
      await page.getByRole("button", { name: "Lacak" }).click();
      await expect(page.getByRole("alert")).toContainText("tidak cocok", { timeout: 2000 });
    }).toPass({ timeout: 15_000 });
    await expect(page.getByTestId("hasil-lacak")).toHaveCount(0);
  });

  test("the help centre serves the curated FAQ and WhatsApp narahubung without stale programme dates", async ({ page }) => {
    await installMockDirectus(page);
    await page.goto("/faq");

    await expect(page.getByTestId("faq-1")).toContainText("Bagaimana cara mengajukan konsultasi?");
    await expect(page.getByTestId("faq-1")).toContainText("Diperbarui");
    const hotline = page.getByRole("region", { name: "Kontak resmi DISKUK" });
    await expect(hotline.getByRole("link", { name: "Hubungi via WhatsApp" })).toHaveAttribute("href", /^https:\/\/wa\.me\/6281100000000/);

    // No leftover intake year: the seeded answers described the 2025 programme.
    await expect(page.getByText("2025", { exact: false })).toHaveCount(0);
    await page.goto("/");
    await expect(page.locator("#section-faq")).not.toContainText("2025");
  });

  test("clinic staff see the PMSE flag, only the next stage, and the audit trail of a stale write", async ({ page }) => {
    const state = createProgramState();
    const tiket = tiketFixture();
    state.tiket.push(tiket);
    await installMockDirectus(page, { authenticated: true });
    await installMockProgram(page, state);
    await loginMock(page, "/dashboard/klinik");

    // Urgent PMSE complaint is flagged on the card and filterable.
    await expect(page.getByTestId("kolom-masuk").getByTestId("badge-pmse")).toHaveText("PMSE mendesak");
    await page.getByTestId("filter-pmse").click();
    await expect(page.getByTestId("kolom-masuk")).toContainText("Warung Bu Siti");

    await page.getByRole("button", { name: "Warung Bu Siti" }).click();
    // Only the stage it may move to is offered, never a jump over the flow.
    const status = page.getByTestId("pilih-status");
    await expect(status.locator("option")).toHaveText(["Tiket Masuk", "Jadwal Ditetapkan", "Dibatalkan"]);
    await page.getByRole("button", { name: "Ambil tiket ini" }).click();
    await expect(page.getByText("Pendamping: Analis Provinsi")).toBeVisible();

    await page.getByLabel("Rencana aksi").fill("Adukan pembekuan akun ke SAPA UMKM");
    await page.getByRole("button", { name: "Simpan" }).click();
    await expect(page.getByTestId("riwayat-tiket")).toContainText("Catatan:", { timeout: 15_000 });
    await expect(page.getByTestId("riwayat-tiket")).toContainText("rencana aksi");
    await expect(page.getByTestId("riwayat-tiket")).toContainText("Analis Provinsi");

    // Another officer wrote meanwhile: the PATCH carries the stale version and is refused.
    tiket.versi = "2026-09-27T12:34:56.000001Z";
    await page.getByLabel("Catatan internal").fill("Catatan kedua");
    await page.getByRole("button", { name: "Simpan" }).click();
    await expect(page.getByText("sudah diubah petugas lain", { exact: false })).toBeVisible({ timeout: 15_000 });
  });

  test("cancelled tickets hide behind a toggle and can be rescheduled", async ({ page }) => {
    const state = createProgramState();
    state.tiket.push(tiketFixture());
    state.tiket.push(tiketFixture({ id: "bbbbbbbb-bbbb-4bbb-8bbb-000000000007", nomor: "KLN-2026-09-0007", namaUsaha: "Warung Batal", status: "batal", jadwalSlot: "13:00" }));
    await installMockDirectus(page, { authenticated: true });
    await installMockProgram(page, state);
    await loginMock(page, "/dashboard/klinik");

    // Kanban stays five columns: the cancelled ticket is invisible until the toggle.
    await expect(page.getByTestId("kolom-masuk")).toBeVisible();
    await expect(page.getByTestId("kolom-batal")).toHaveCount(0);

    const arsipRequest = page.waitForRequest((req) => req.url().includes("/panel/v1/program/klinik/tiket?status=batal"));
    await page.getByTestId("toggle-batal").check();
    await arsipRequest;
    await expect(page.getByTestId("kolom-batal")).toContainText("Warung Batal");

    // The only forward move from batal is dijadwalkan; afterwards it leaves the archive.
    await page.getByTestId("kolom-batal").getByRole("button", { name: "Pindahkan KLN-2026-09-0007 ke tahap berikutnya" }).click();
    await expect(page.getByTestId("kolom-batal")).toHaveCount(0);
    // Back on the five-column kanban the rescheduled ticket sits in Dijadwalkan.
    await page.getByTestId("toggle-batal").uncheck();
    await expect(page.getByTestId("kolom-dijadwalkan")).toContainText("Warung Batal");
  });

  test("a UMKM account gets the read-back form instead of the staff kanban", async ({ page }) => {
    const state = createProgramState();
    state.tiket.push(tiketFixture({ pemohon: MOCK_USER.id, whatsapp: "081234567890" }));
    await installMockDirectus(page, { authenticated: true, role: "umkm" });
    await installMockProgram(page, state);
    await loginMock(page, "/dashboard/klinik");

    await expect(page.getByRole("region", { name: "Lacak tiket konsultasi" })).toBeVisible();
    await expect(page.getByRole("group", { name: "Tampilan" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Simpan" })).toHaveCount(0);
  });

  test("the clinic landing and help centre stack on a phone viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installMockDirectus(page);
    await page.goto("/konsultasi");
    await expect(page.getByTestId("poli-kartu")).toHaveCount(6);
    // The desks and the form stay inside the viewport. The shared landing header bleeds past it on
    // every public page (pre-existing `LandingHeaderMask` image), so only Y09's own sections are
    // measured here.
    const lebarPoli = await page.getByTestId("daftar-poli").evaluate((el) => el.getBoundingClientRect().right);
    expect(lebarPoli).toBeLessThanOrEqual(390);
    await expect(page.getByRole("group", { name: "Tampilan klinik" })).toBeVisible();
    const lebarForm = await page.locator("#form-klinik").evaluate((el) => el.getBoundingClientRect().right);
    expect(lebarForm).toBeLessThanOrEqual(390);
    await page.goto("/faq");
    await expect(page.getByTestId("faq-1")).toBeVisible();
    const lebarFaq = await page.getByTestId("faq-1").evaluate((el) => el.getBoundingClientRect().right);
    expect(lebarFaq).toBeLessThanOrEqual(390);
  });
});
