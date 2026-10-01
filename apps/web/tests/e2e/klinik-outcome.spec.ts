import { test, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { installMockDirectus, loginMock } from "../fixtures/mock-directus.mjs";
import { hasilKonsultasiProfil, klinikMockResponse } from "../fixtures/klinik-data.mjs";
import { USAHA_ID, VERSI_AWAL, createProgramState, installMockProgram, pindahKlien } from "../fixtures/mock-program.mjs";

// R04 · N7-04/N7-05: statistik, direktori konsultan, dan CSAT di halaman publik klinik; outcome
// konsultasi (catat, verifikasi oleh aktor lain, koreksi, cabut) di panel petugas; hasilnya di profil
// usaha. Mock mengimpor aturan endpoint yang sama, jadi peran, wilayah, dan aktor berbeda dijaga server.
// Beberapa petugas berjalan bersamaan: tiap petugas satu konteks browser di atas satu state mock.

const ID_T1 = "aaaaaaaa-aaaa-4aaa-8aaa-000000000001";
const ID_T2 = "aaaaaaaa-aaaa-4aaa-8aaa-000000000002";
const ID_T3 = "aaaaaaaa-aaaa-4aaa-8aaa-000000000003";
const PROFIL_USAHA = `/dashboard/data-lapangan/${USAHA_ID}`;

/** Identitas petugas di sisi mock endpoint: id berbeda berarti orang berbeda, `kotaId` wilayah kab/kota. */
interface Aktor {
  id: string;
  admin: boolean;
  peran: string;
  kotaId: number | null;
  nama: string;
}

const AKTOR = {
  pendamping: { id: "user-3", admin: false, peran: "pendamping", kotaId: null, nama: "Pendamping" },
  provinsi: { id: "user-provinsi", admin: false, peran: "provinsi", kotaId: null, nama: "Analis Provinsi" },
  provinsiLain: { id: "user-provinsi-2", admin: false, peran: "provinsi", kotaId: null, nama: "Verifikator Provinsi" },
  kabkota: { id: "user-2", admin: false, peran: "kabkota", kotaId: 1, nama: "Analis Daerah" },
  kabkotaLain: { id: "user-kab-lain", admin: false, peran: "kabkota", kotaId: 2, nama: "Analis Kota Lain" },
} satisfies Record<string, Aktor>;

/** Next weekday at least `offset` days ahead (Jakarta ≈ UTC+7), as YYYY-MM-DD. */
function nextWeekday(offset: number) {
  const date = new Date(Date.now() + 7 * 3_600_000 + offset * 86_400_000);
  while ([0, 6].includes(date.getUTCDay())) date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

/** A stored ticket as the clinic mock keeps it; `usaha` and `kotaId` decide who may record and verify an outcome. */
function tiketFixture(overrides = {}) {
  return {
    id: ID_T1,
    nomor: "KLN-2026-09-0001",
    usaha: USAHA_ID,
    kotaId: 1,
    namaUsaha: "Toko Kulit Maju",
    namaKontak: "Wawan",
    whatsapp: "081234567890",
    email: null,
    poli: 1,
    poliNama: "Legalitas & Standardisasi Produk",
    deskripsi: "Butuh bantuan mengurus sertifikat halal dan NPWP usaha.",
    moda: "daring",
    jadwalTanggal: nextWeekday(2),
    jadwalSlot: "10:30",
    prioritas: "normal",
    status: "selesai",
    pendamping: AKTOR.pendamping.id,
    pendampingNama: "Pendamping",
    pemohon: null,
    sumberIdentitas: "sidt",
    waConsent: true,
    linkMeet: null,
    diagnosis: { legalitas: "DIAGNOSIS-RAHASIA belum punya NPWP" },
    actionPlan: "RENCANA-RAHASIA daftar NPWP",
    rujukan: [],
    catatan: "CATATAN-RAHASIA internal",
    lampiran: [],
    notifikasi: { status: "pending", label: "Menunggu dikirim", jenis: "tiket_dibuat", template: "klinik_tiket_dibuat", attempts: 0, lastError: null },
    versi: VERSI_AWAL,
    riwayat: [],
    dateCreated: "2026-09-26T00:00:00Z",
    dateUpdated: "2026-09-26T00:00:00Z",
    ...overrides,
  };
}

const konteksAktif: BrowserContext[] = [];
test.afterEach(async () => {
  await Promise.all(konteksAktif.splice(0).map((konteks) => konteks.close()));
});

/**
 * Satu petugas = satu konteks browser yang masuk sebagai `peran`, di atas `state` yang sama dengan
 * petugas lain. `aktor` memilih identitas di sisi mock endpoint (id berbeda = orang berbeda).
 */
async function sesiPetugas(browser: Browser, baseURL: string | undefined, state: ReturnType<typeof createProgramState>, aktor: Aktor, peran: string): Promise<Page> {
  const konteks = await browser.newContext({ baseURL, timezoneId: "UTC" });
  konteksAktif.push(konteks);
  const page = await konteks.newPage();
  await installMockDirectus(page, { authenticated: true, role: peran, hasilKonsultasi: (usahaId: string) => hasilKonsultasiProfil(state, usahaId) });
  await installMockProgram(page, Object.assign(Object.create(state), { aktor }));
  await loginMock(page, "/dashboard/klinik");
  return page;
}

const kartu = (page: Page, nama: string) => page.getByRole("button", { name: nama, exact: true });

/** Opens the ticket sheet from the kanban and returns its outcome section. */
async function bukaTiket(page: Page, nama: string) {
  await kartu(page, nama).click();
  return page.getByTestId("outcome-tiket");
}

/** Tracking form: retried until hydration attaches the handlers and the ticket answers. */
async function lacak(page: Page, nomor: string, whatsapp = "081234567890") {
  await expect(async () => {
    await page.getByLabel("Nomor tiket").fill(nomor);
    await page.getByLabel("Nomor WhatsApp").fill(whatsapp);
    await page.getByRole("button", { name: "Lacak", exact: true }).click();
    await expect(page.getByTestId("hasil-lacak")).toContainText(nomor, { timeout: 3000 });
  }).toPass({ timeout: 25_000 });
}

async function bukaLacak(page: Page) {
  await expect(async () => {
    await page.getByRole("group", { name: "Tampilan klinik" }).getByRole("button", { name: "Lacak tiket", exact: true }).click();
    await expect(page.getByRole("region", { name: "Lacak tiket konsultasi" })).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 20_000 });
}

test.describe("R04 · Klinik: statistik, direktori, dan penilaian (halaman publik)", () => {
  test("the landing shows honest service figures and the consultant directory, including one with no free slot", async ({ page }) => {
    await installMockDirectus(page);
    await installMockProgram(page, createProgramState());
    await page.goto("/konsultasi");

    // Figures come from the server with their own definition; a missing CSAT is words, never a number.
    const statistik = page.getByTestId("statistik-klinik");
    await expect(statistik.getByTestId("stat-total")).toContainText("Konsultasi selesai");
    await expect(statistik.getByTestId("stat-total").locator("dd").first()).toHaveText("12");
    await expect(statistik.getByTestId("stat-respons").locator("dd").first()).toContainText("5,5");
    await expect(statistik.getByTestId("stat-respons")).toContainText("Target kurang dari 24 jam");
    await expect(statistik.getByTestId("stat-respons")).toContainText("dari 9 tiket");
    await expect(statistik.getByTestId("stat-respons")).toContainText("Rata-rata jam kalender");
    await expect(statistik.getByTestId("stat-csat").locator("dd").first()).toHaveText("Belum ada penilaian");
    await expect(statistik.getByTestId("stat-csat")).not.toContainText("/ 5");
    await expect(statistik.getByTestId("stat-csat")).not.toContainText("0,00");
    await expect(statistik.getByTestId("stat-csat")).toContainText("Belum ada jawaban berarti belum ada nilai");

    // Directory: one card per consultant with affiliation, weekly service and the nearest free slots.
    const direktori = page.getByTestId("direktori-konsultan");
    await expect(direktori.getByTestId("konsultan-kartu")).toHaveCount(3);
    const rina = direktori.getByTestId("konsultan-kartu").filter({ hasText: "Rina Kusumawardani" });
    await expect(rina.getByTestId("konsultan-afiliasi")).toHaveText("PLUT");
    await expect(rina).toContainText("Legalitas & Standardisasi Produk");
    await expect(rina).toContainText("Senin, Rabu, Jumat");
    await expect(rina.getByTestId("konsultan-tanggal").first()).toContainText("10:30");
    // 09:00 is already booked on every desk, so it is offered as service hours but never as a free slot.
    await expect(rina.getByTestId("konsultan-tanggal").first()).not.toContainText("09:00");

    const tanpaSlot = direktori.getByTestId("konsultan-kartu").filter({ hasText: "Lestari Wulandari" });
    await expect(tanpaSlot.getByTestId("konsultan-afiliasi")).toHaveText("Praktisi");
    await expect(tanpaSlot.getByTestId("konsultan-belum-ada-slot")).toHaveText("Belum ada slot dalam 14 hari ke depan.");
    await expect(tanpaSlot.getByTestId("konsultan-tanggal")).toHaveCount(0);

    // The booking form is still one tab away.
    await expect(page.getByTestId("poli-kartu")).toHaveCount(6);
  });

  test("a failing statistics or directory fetch degrades to a note and leaves the booking form usable", async ({ page }) => {
    await installMockDirectus(page);
    await installMockProgram(page, createProgramState());
    await page.route("**/panel/v1/program/klinik/statistik", (route) => route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ errors: [{ message: "boom", extensions: { code: "INTERNAL_SERVER_ERROR" } }] }) }));
    await page.route("**/panel/v1/program/klinik/konsultan*", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { rentang: { dari: null, sampai: null }, konsultan: [] } }) }));

    // Reached client-side so the browser mocks answer (a full load is server-rendered against the static mock server).
    await page.goto("/faq");
    await expect(page.getByTestId("faq-1")).toBeVisible();
    await pindahKlien(page, "/konsultasi");

    await expect(page.getByTestId("statistik-gagal")).toContainText("Statistik layanan belum dapat dimuat");
    await expect(page.getByTestId("direktori-kosong")).toHaveText("Direktori belum tersedia.");
    await expect(page.getByTestId("poli-kartu")).toHaveCount(6);
    await page.getByRole("button", { name: "Ajukan konsultasi" }).first().click();
    await expect(page.getByRole("heading", { name: "Identitas usaha" })).toBeVisible();
    await page.getByLabel("Nama usaha").fill("Warung Bu Siti");
    await page.getByLabel("Nama narahubung").fill("Siti");
    await page.getByLabel("Nomor WhatsApp").fill("081234567890");
    await page.getByRole("button", { name: "Lanjut" }).click();
    await expect(page.getByLabel("Ceritakan permasalahan usaha Anda")).toBeVisible();
  });

  test("a requester rates a completed ticket with consent, sees a thank-you, and a second look shows it is already rated", async ({ page }) => {
    const state = createProgramState();
    state.tiket.push(
      tiketFixture(),
      tiketFixture({ id: ID_T2, nomor: "KLN-2026-09-0002", status: "masuk", usaha: null }),
      tiketFixture({ id: ID_T3, nomor: "KLN-2026-09-0003", status: "selesai" }),
    );
    await installMockDirectus(page);
    await installMockProgram(page, state);
    await page.goto("/konsultasi");
    await bukaLacak(page);

    // A ticket that is not finished offers no rating.
    await lacak(page, "KLN-2026-09-0002");
    await expect(page.getByTestId("hasil-lacak")).toContainText("Tiket Masuk");
    await expect(page.getByTestId("csat")).toHaveCount(0);

    // A finished one does. Consent is off by default and the form says what that means.
    await lacak(page, "KLN-2026-09-0001");
    const form = page.getByTestId("csat-form");
    await expect(form).toBeVisible();
    await expect(page.getByLabel("Saya setuju penilaian saya (tanpa identitas) dihitung dalam statistik layanan")).not.toBeChecked();
    await expect(page.getByTestId("csat-tanpa-consent")).toContainText("tidak dihitung dalam statistik layanan");
    await form.getByRole("button", { name: "Kirim penilaian" }).click();
    await expect(form.getByRole("alert")).toContainText("Pilih nilai 1–5");

    await form.getByRole("radio", { name: "4 dari 5" }).check();
    await page.getByLabel("Saya setuju penilaian saya (tanpa identitas) dihitung dalam statistik layanan").check();
    await expect(page.getByTestId("csat-tanpa-consent")).toHaveCount(0);
    await form.getByRole("button", { name: "Kirim penilaian" }).click();

    await expect(page.getByTestId("csat-terima-kasih")).toContainText("Terima kasih atas penilaian Anda");
    await expect(page.getByTestId("csat-terima-kasih")).toContainText("dihitung dalam statistik layanan");
    await expect(page.getByTestId("csat-form")).toHaveCount(0);
    expect(state.csat).toEqual([{ tiket: ID_T1, nilai: 4, consent: true }]);
    const kirim = state.requests.find((request) => request.method === "POST" && request.path === "/klinik/tiket/csat");
    expect(kirim?.body).toMatchObject({ nomor: "KLN-2026-09-0001", whatsapp: "081234567890", nilai: 4, consent: true });
    expect(kirim?.body.captcha).toBeTruthy();

    // Looking the same ticket up again: already rated, no second form.
    await lacak(page, "KLN-2026-09-0001");
    await expect(page.getByTestId("csat-sudah-menilai")).toHaveText("Terima kasih, penilaian sudah tercatat.");
    await expect(page.getByTestId("csat-form")).toHaveCount(0);

    // Without consent the answer is kept but the thank-you says it is not counted.
    await lacak(page, "KLN-2026-09-0003");
    await page.getByTestId("csat-form").getByRole("radio", { name: "2 dari 5" }).check();
    await page.getByTestId("csat-form").getByRole("button", { name: "Kirim penilaian" }).click();
    await expect(page.getByTestId("csat-terima-kasih")).toContainText("tidak dihitung dalam statistik layanan");
    expect(state.csat.at(-1)).toEqual({ tiket: ID_T3, nilai: 2, consent: false });
  });
});

test.describe("R04 · Klinik: outcome konsultasi (panel petugas dan profil usaha)", () => {
  test("a pendamping closes a ticket with an outcome and records another; provinsi verifies it from the queue and the profile lists it; another city sees nothing", async ({ browser, baseURL }) => {
    test.setTimeout(180_000);
    const state = createProgramState();
    state.tiket.push(
      tiketFixture({ status: "tindak_lanjut" }),
      tiketFixture({ id: ID_T2, nomor: "KLN-2026-09-0002", namaUsaha: "Toko Batik Sari", status: "selesai", jadwalSlot: "13:00" }),
    );

    // ── Pendamping: closes T1 with an outcome (checklist) and records T2's outcome afterwards ──
    const pendamping = await sesiPetugas(browser, baseURL, state, AKTOR.pendamping, "pendamping");
    await kartu(pendamping, "Toko Kulit Maju").click();
    await pendamping.getByTestId("pilih-status").click();
    await pendamping.getByRole("option", { name: "Selesai", exact: true }).click();
    await expect(pendamping.getByTestId("outcome-penutupan")).toContainText("boleh dikosongkan");
    await pendamping.getByRole("button", { name: "NPWP Usaha: Kepatuhan" }).click();
    await pendamping.getByRole("button", { name: "QRIS: Perbaikan" }).click();
    await expect(pendamping.getByRole("button", { name: "QRIS: Perbaikan" })).toHaveAttribute("aria-pressed", "true");
    await pendamping.getByRole("button", { name: "Simpan", exact: true }).click();

    const t1 = pendamping.getByTestId("outcome-tiket");
    await expect(t1.getByTestId("outcome-status")).toHaveText("Menunggu verifikasi");
    await expect(t1.getByTestId("outcome-items")).toContainText("NPWP Usaha");
    await expect(t1.getByTestId("outcome-items")).toContainText("QRIS");
    // A pendamping only submits: the server offers no verify, correct or revoke.
    await expect(t1.getByRole("button", { name: /^(Verifikasi|Koreksi|Cabut)$/ })).toHaveCount(0);
    const tutup = state.requests.filter((request) => request.method === "PATCH").at(-1);
    expect(tutup?.body).toMatchObject({ status: "selesai", outcome: { items: [{ atribut: "npwp_usaha", jenis: "kepatuhan" }, { atribut: "qris", jenis: "perbaikan" }] } });
    await pendamping.keyboard.press("Escape");

    const t2 = await bukaTiket(pendamping, "Toko Batik Sari");
    await expect(t2.getByTestId("outcome-catat")).toBeVisible();
    await t2.getByRole("button", { name: "SNI: Kepatuhan" }).click();
    await t2.getByRole("button", { name: "Catat outcome", exact: true }).click();
    await expect(t2.getByTestId("outcome-status")).toHaveText("Menunggu verifikasi");
    await expect(t2.getByTestId("outcome-catat")).toHaveCount(0);

    // ── Kabkota of another city: the ticket is out of scope, so is its outcome ──
    const kotaLain = await sesiPetugas(browser, baseURL, state, AKTOR.kabkotaLain, "kabkota");
    await expect(kotaLain.getByText("Belum ada tiket dalam penugasan Anda.")).toBeVisible();
    await expect(kotaLain.getByTestId("outcome-antrean-kosong")).toHaveText("Tidak ada outcome yang menunggu verifikasi.");
    await expect(kotaLain.getByTestId("outcome-antrean-baris")).toHaveCount(0);

    // ── Provinsi: verifies from the queue; the button is safe against a double click ──
    const provinsi = await sesiPetugas(browser, baseURL, state, AKTOR.provinsi, "provinsi");
    const antrean = provinsi.getByTestId("outcome-antrean");
    await expect(antrean.getByTestId("outcome-antrean-jumlah")).toHaveText("2 menunggu");
    const baris1 = antrean.getByTestId("outcome-antrean-baris").filter({ hasText: "KLN-2026-09-0001" });
    await expect(baris1).toContainText("Toko Kulit Maju");
    await expect(baris1).toContainText("Legalitas & Standardisasi Produk");

    // The server said "verify" was allowed; if the row was in fact submitted by this same person the refusal is friendly.
    const baris2 = antrean.getByTestId("outcome-antrean-baris").filter({ hasText: "KLN-2026-09-0002" });
    state.outcomes.find((outcome: { nomorTiket: string }) => outcome.nomorTiket === "KLN-2026-09-0002").diajukanOleh = AKTOR.provinsi.id;
    await baris2.getByRole("button", { name: "Verifikasi", exact: true }).click();
    await expect(baris2.getByRole("alert")).toHaveText("Outcome harus diverifikasi oleh petugas lain, bukan pengaju.");
    await expect(antrean.getByTestId("outcome-antrean-baris")).toHaveCount(2);

    await provinsi.route("**/panel/v1/program/klinik/outcome/*/verifikasi", async (route) => {
      await new Promise((selesai) => setTimeout(selesai, 500));
      await route.fallback();
    });
    await baris1.getByRole("button", { name: "Verifikasi", exact: true }).dblclick();
    await expect(antrean.getByTestId("outcome-antrean-jumlah")).toHaveText("1 menunggu");
    expect(state.requests.filter((request) => request.method === "POST" && request.path.endsWith("/verifikasi") && request.path.includes(state.outcomes[0].id))).toHaveLength(1);

    // ── Profile: only the verified outcome, never the session notes ──
    await pindahKlien(provinsi, PROFIL_USAHA);
    const hasil = provinsi.getByTestId("hasil-konsultasi");
    await expect(hasil.getByRole("heading", { name: "Hasil konsultasi klinik (terverifikasi)" })).toBeVisible();
    await expect(hasil.getByTestId("hasil-konsultasi-item")).toHaveCount(1);
    await expect(hasil).toContainText("KLN-2026-09-0001");
    await expect(hasil).toContainText("Legalitas & Standardisasi Produk");
    await expect(hasil).toContainText("Diverifikasi oleh Analis Provinsi");
    await expect(hasil).toContainText("NPWP Usaha · Kepatuhan");
    await expect(hasil).toContainText("QRIS · Perbaikan");
    await expect(hasil).not.toContainText("KLN-2026-09-0002");
    await expect(provinsi.locator("body")).not.toContainText("RAHASIA");
  });

  test("the submitter cannot verify their own outcome, but a kabkota of the same city can", async ({ browser, baseURL }) => {
    test.setTimeout(150_000);
    const state = createProgramState();
    state.tiket.push(tiketFixture({ id: ID_T3, nomor: "KLN-2026-09-0003", namaUsaha: "Toko Kulit Maju", pendamping: null, pendampingNama: null }));

    const provinsi = await sesiPetugas(browser, baseURL, state, AKTOR.provinsi, "provinsi");
    const bagian = await bukaTiket(provinsi, "Toko Kulit Maju");
    await bagian.getByRole("button", { name: "Sertifikat Halal: Kepatuhan" }).click();
    await bagian.getByRole("button", { name: "Catat outcome", exact: true }).click();
    await expect(bagian.getByTestId("outcome-status")).toHaveText("Menunggu verifikasi");
    // The submitter may correct or revoke their own outcome but never verify it.
    await expect(bagian.getByRole("button", { name: "Koreksi", exact: true })).toBeVisible();
    await expect(bagian.getByRole("button", { name: "Cabut", exact: true })).toBeVisible();
    await expect(bagian.getByRole("button", { name: "Verifikasi", exact: true })).toHaveCount(0);
    await provinsi.keyboard.press("Escape");
    const sendiri = provinsi.getByTestId("outcome-antrean-baris").filter({ hasText: "KLN-2026-09-0003" });
    await expect(sendiri.getByRole("button", { name: "Koreksi", exact: true })).toBeVisible();
    await expect(sendiri.getByRole("button", { name: "Verifikasi", exact: true })).toHaveCount(0);

    const kota = await sesiPetugas(browser, baseURL, state, AKTOR.kabkota, "kabkota");
    const baris = kota.getByTestId("outcome-antrean-baris").filter({ hasText: "KLN-2026-09-0003" });
    await baris.getByRole("button", { name: "Verifikasi", exact: true }).click();
    await expect(kota.getByTestId("outcome-antrean-kosong")).toBeVisible();
    expect(state.outcomes[0]).toMatchObject({ status: "terverifikasi", diajukanNama: "Analis Provinsi", diverifikasiNama: "Analis Daerah" });
  });

  test("koreksi and cabut need a reason, refuse an unchanged correction, and update the profile", async ({ browser, baseURL }) => {
    test.setTimeout(120_000);
    const state = createProgramState();
    state.tiket.push(tiketFixture());
    // Seeded through the same mock endpoints: submitted by the pendamping, verified by another provinsi officer.
    const isi = [{ atribut: "npwp_usaha", jenis: "kepatuhan" }, { atribut: "qris", jenis: "perbaikan" }];
    const diajukan = klinikMockResponse({ method: "POST", path: `/klinik/tiket/${ID_T1}/outcome`, body: { items: isi }, state: Object.assign(Object.create(state), { aktor: AKTOR.pendamping }) });
    klinikMockResponse({ method: "POST", path: `/klinik/outcome/${diajukan.data.id}/verifikasi`, body: {}, state: Object.assign(Object.create(state), { aktor: AKTOR.provinsiLain }) });

    const provinsi = await sesiPetugas(browser, baseURL, state, AKTOR.provinsi, "provinsi");
    const outcome = await bukaTiket(provinsi, "Toko Kulit Maju");
    await expect(outcome.getByTestId("outcome-status")).toHaveText("Terverifikasi");
    await expect(outcome.getByRole("button", { name: "Verifikasi", exact: true })).toHaveCount(0);
    await expect(outcome.getByTestId("outcome-catat")).toHaveCount(0);
    await provinsi.keyboard.press("Escape");

    await pindahKlien(provinsi, PROFIL_USAHA);
    await expect(provinsi.getByTestId("hasil-konsultasi-item")).toContainText("Diverifikasi oleh Verifikator Provinsi");
    await expect(provinsi.getByTestId("hasil-konsultasi-item")).toContainText("QRIS · Perbaikan");
    await pindahKlien(provinsi, "/dashboard/klinik");

    // Koreksi: an identical list is refused by the server, a short reason never leaves the browser.
    await bukaTiket(provinsi, "Toko Kulit Maju");
    await provinsi.getByRole("button", { name: "Koreksi", exact: true }).click();
    const koreksi = provinsi.getByTestId("outcome-form-koreksi");
    await koreksi.getByLabel("Alasan koreksi").fill("Isi sama saja");
    await koreksi.getByRole("button", { name: "Simpan koreksi" }).click();
    await expect(koreksi.getByRole("alert")).toHaveText("Isi koreksi sama dengan outcome saat ini. Ubah minimal satu atribut.");

    await koreksi.getByRole("button", { name: "QRIS: Perbaikan" }).click();
    await koreksi.getByRole("button", { name: "SNI: Perbaikan" }).click();
    await koreksi.getByLabel("Alasan koreksi").fill("abc");
    await koreksi.getByRole("button", { name: "Simpan koreksi" }).click();
    await expect(koreksi.getByRole("alert")).toHaveText("Isi alasan koreksi minimal 5 karakter.");
    await koreksi.getByLabel("Alasan koreksi").fill("QRIS belum aktif, SNI sedang diurus");
    await koreksi.getByRole("button", { name: "Simpan koreksi" }).click();

    const panel = provinsi.getByTestId("outcome-tiket");
    await expect(panel).toContainText("Versi 2");
    await expect(panel.getByTestId("outcome-status")).toHaveText("Terverifikasi");
    await expect(panel.getByTestId("outcome-items")).toContainText("SNI");
    await expect(panel.getByTestId("outcome-items")).not.toContainText("QRIS");
    expect(state.outcomes.find((baris: { versi: number }) => baris.versi === 1)).toMatchObject({ status: "dicabut", alasanCabut: "Dikoreksi ke versi 2: QRIS belum aktif, SNI sedang diurus" });

    await provinsi.keyboard.press("Escape");
    await pindahKlien(provinsi, PROFIL_USAHA);
    await expect(provinsi.getByTestId("hasil-konsultasi-item")).toHaveCount(1);
    await expect(provinsi.getByTestId("hasil-konsultasi-item")).toContainText("SNI · Perbaikan");
    await expect(provinsi.getByTestId("hasil-konsultasi-item")).not.toContainText("QRIS");
    await pindahKlien(provinsi, "/dashboard/klinik");

    // Cabut: also needs a reason; afterwards the profile is empty again and a fresh outcome may be recorded.
    await bukaTiket(provinsi, "Toko Kulit Maju");
    await provinsi.getByRole("button", { name: "Cabut", exact: true }).click();
    const cabut = provinsi.getByTestId("outcome-form-cabut");
    await cabut.getByLabel("Alasan pencabutan").fill("abc");
    await cabut.getByRole("button", { name: "Cabut outcome" }).click();
    await expect(cabut.getByRole("alert")).toHaveText("Isi alasan pencabutan minimal 5 karakter.");
    await cabut.getByLabel("Alasan pencabutan").fill("Salah catat");
    await cabut.getByRole("button", { name: "Cabut outcome" }).click();

    const dicabut = provinsi.getByTestId("outcome-tiket");
    await expect(dicabut.getByTestId("outcome-status")).toHaveText("Dicabut");
    await expect(dicabut.getByTestId("outcome-alasan-cabut")).toContainText("Salah catat");
    await expect(dicabut.getByRole("button", { name: /^(Verifikasi|Koreksi|Cabut)$/ })).toHaveCount(0);
    await expect(dicabut.getByTestId("outcome-catat")).toBeVisible();

    await provinsi.keyboard.press("Escape");
    await pindahKlien(provinsi, PROFIL_USAHA);
    await expect(provinsi.getByTestId("hasil-konsultasi")).toContainText("Belum ada hasil konsultasi terverifikasi.");
    await expect(provinsi.getByTestId("hasil-konsultasi-item")).toHaveCount(0);
  });
});
