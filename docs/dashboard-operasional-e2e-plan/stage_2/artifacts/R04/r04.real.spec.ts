// R04 real-API browser proof (N7-04, N7-05): Nuxt dev (source of the day) → Directus clone `r04-directus`
// (127.0.0.1:8156, DB r04_clone), real ALTCHA on login, SQL readback after each step. Clone only.
// Run from apps/web after copying this file to tests/real-r04/ (see runtime-evidence.md):
//   PLAYWRIGHT_BASE_URL=http://127.0.0.1:3120 R04_ART=<dir> pnpm exec playwright test -c <config> ...
import { execFileSync } from "node:child_process";
import { test, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";

const ART = process.env.R04_ART ?? "/tmp";
const PASS = "R04-uji-Pass#2026"; // clone-only
const USAHA = "d0000000-0000-4000-8000-000000000001";
const sql = (q: string) =>
  execFileSync("docker", ["exec", "-i", "diskuk-operasional-e2e-postgis-1", "psql", "-U", "diskuk_app", "-d", "r04_clone", "-Atc", q], { encoding: "utf8" }).trim();
const nextWeekday = (offset: number) => {
  const d = new Date(Date.now() + 7 * 3_600_000 + offset * 86_400_000);
  while ([0, 6].includes(d.getUTCDay())) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};
const RAHASIA = ["R04-BROWSER-CATATAN", "R04-BROWSER-DIAGNOSIS", "R04-BROWSER-RENCANA"];
const T1 = { nomor: "KLN-2026-09-9001", nama: "Toko Uji R04 Satu", wa: "6281255509001" }; // ditutup dengan outcome
const T2 = { nomor: "KLN-2026-09-9002", nama: "Toko Uji R04 Dua", wa: "6281255509002" }; // sudah selesai, untuk CSAT

async function login(page: Page, email: string, returnTo: string) {
  await page.goto(`/sign-in?returnTo=${encodeURIComponent(returnTo)}`);
  await page.waitForLoadState("networkidle");
  // Nilai yang diketik sebelum hidrasi hilang: ulangi seluruh form sampai widget ALTCHA terverifikasi.
  await expect(async () => {
    await page.getByLabel("Email atau NIB").fill(email);
    await page.getByRole("textbox", { name: "Kata sandi" }).fill(PASS);
    await expect(page.getByLabel("Email atau NIB")).toHaveValue(email, { timeout: 1000 });
    if ((await page.locator("altcha-widget .altcha").getAttribute("data-state")) !== "verified") await page.locator("altcha-widget label").click();
    await expect(page.locator("altcha-widget .altcha")).toHaveAttribute("data-state", "verified", { timeout: 15_000 });
  }).toPass({ timeout: 60_000 });
  await page.getByRole("button", { name: "Masuk ke Dashboard", exact: true }).click();
  await page.waitForURL((url) => url.pathname === returnTo.split("?")[0], { timeout: 30_000 });
}

const konteks: BrowserContext[] = [];
test.afterAll(async () => {
  await Promise.all(konteks.splice(0).map((c) => c.close()));
});
async function sesi(browser: Browser, baseURL: string | undefined, email: string, returnTo: string): Promise<Page> {
  const context = await browser.newContext({ baseURL, timezoneId: "UTC" });
  konteks.push(context);
  const page = await context.newPage();
  await login(page, email, returnTo);
  return page;
}

test.describe.serial("R04 klinik: statistik, direktori, CSAT, outcome (real API)", () => {
  test.beforeAll(() => {
    const tanggal = nextWeekday(20);
    const uid = (email: string) => sql(`SELECT id FROM directus_users WHERE email = '${email}'`);
    const pend = uid("dummy_coach.pendamping@jabarprov.go.id");
    const buat = (t: typeof T1, slot: string, status: string, rahasia: boolean) =>
      sql(`INSERT INTO konsultasi_tiket (nomor, usaha, nama_usaha, nama_kontak, whatsapp, poli, deskripsi, moda, jadwal_tanggal, jadwal_slot, status, pendamping, sumber_identitas, wa_consent, catatan, diagnosis, action_plan)
           VALUES ('${t.nomor}', '${USAHA}', '${t.nama}', 'Kontak Browser', '${t.wa}', 1, 'Tiket uji browser R04 untuk outcome dan CSAT.', 'daring', '${tanggal}', '${slot}', '${status}', '${pend}', 'sidt', TRUE,
                   ${rahasia ? `'${RAHASIA[0]}', '{"legalitas":"${RAHASIA[1]}"}'::jsonb, '${RAHASIA[2]}'` : "NULL, '{}'::jsonb, NULL"})`);
    buat(T1, "09:00", "tindak_lanjut", true);
    buat(T2, "10:30", "selesai", false);
    // Direktori: satu konsultan dengan slot bebas, satu yang semua slotnya terpakai (tiket poli 1 pada tanggal itu tidak relevan: jadwal Senin saja tanpa Senin bebas).
    sql(`INSERT INTO klinik_konsultan (nama, poli, afiliasi, hari, slot, aktif, sort) VALUES
         ('Konsultan Browser Satu', 1, 'plut', '["senin","rabu","jumat"]', '["10:30","13:00"]', TRUE, 1),
         ('Konsultan Browser Praktisi', 2, 'praktisi', '[]', '["09:00"]', TRUE, 2)`);
  });

  test("halaman publik: statistik dan direktori tampil dari server nyata; CSAT kosong = kata-kata, bukan angka", async ({ page }) => {
    await page.goto("/konsultasi");
    const statistik = page.getByTestId("statistik-klinik");
    await expect(statistik).toBeVisible({ timeout: 30_000 });
    const totalSql = sql("SELECT COUNT(*) FROM konsultasi_tiket WHERE status = 'selesai'");
    await expect(statistik.getByTestId("stat-total").locator("dd").first()).toHaveText(new Intl.NumberFormat("id-ID").format(Number(totalSql)));
    await expect(statistik.getByTestId("stat-csat").locator("dd").first()).toHaveText("Belum ada penilaian");
    await expect(statistik.getByTestId("stat-csat")).not.toContainText("/ 5");
    const direktori = page.getByTestId("direktori-konsultan");
    await expect(direktori.getByTestId("konsultan-kartu")).toHaveCount(2);
    const satu = direktori.getByTestId("konsultan-kartu").filter({ hasText: "Konsultan Browser Satu" });
    await expect(satu.getByTestId("konsultan-afiliasi")).toHaveText("PLUT");
    await expect(satu).toContainText("Senin, Rabu, Jumat");
    await expect(satu.getByTestId("konsultan-tanggal").first()).toContainText(/10:30|13:00/);
    const tanpaHari = direktori.getByTestId("konsultan-kartu").filter({ hasText: "Konsultan Browser Praktisi" });
    await expect(tanpaHari.getByTestId("konsultan-belum-ada-slot")).toBeVisible();
    await page.screenshot({ path: `${ART}/r04-browser-1-landing-statistik-direktori.png`, fullPage: true });
  });

  test("pemohon menilai tiket selesai lewat Lacak Tiket (ALTCHA nyata, consent); nilai masuk statistik; penilaian kedua tidak ditawarkan", async ({ page }) => {
    await page.goto("/konsultasi");
    await expect(async () => {
      await page.getByRole("group", { name: "Tampilan klinik" }).getByRole("button", { name: "Lacak tiket", exact: true }).click();
      await expect(page.getByRole("region", { name: "Lacak tiket konsultasi" })).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 30_000 });
    const lacak = async (nomor: string, wa: string) =>
      expect(async () => {
        await page.getByLabel("Nomor tiket").fill(nomor);
        await page.getByLabel("Nomor WhatsApp").fill(wa);
        await page.getByRole("button", { name: "Lacak", exact: true }).click();
        await expect(page.getByTestId("hasil-lacak")).toContainText(nomor, { timeout: 8000 });
      }).toPass({ timeout: 60_000 });

    await lacak(T2.nomor, T2.wa);
    const form = page.getByTestId("csat-form");
    await expect(form).toBeVisible();
    await form.getByRole("radio", { name: "4 dari 5" }).check();
    await page.getByLabel("Saya setuju penilaian saya (tanpa identitas) dihitung dalam statistik layanan").check();
    await page.screenshot({ path: `${ART}/r04-browser-2-csat-form.png` });
    await form.getByRole("button", { name: "Kirim penilaian" }).click();
    await expect(page.getByTestId("csat-terima-kasih")).toContainText("Terima kasih", { timeout: 30_000 });
    expect(sql(`SELECT nilai || '|' || consent FROM konsultasi_tiket_csat WHERE tiket = (SELECT id FROM konsultasi_tiket WHERE nomor = '${T2.nomor}')`)).toBe("4|true");

    await lacak(T2.nomor, T2.wa);
    await expect(page.getByTestId("csat-sudah-menilai")).toBeVisible();
    await expect(page.getByTestId("csat-form")).toHaveCount(0);

    await page.goto("/konsultasi");
    const csat = page.getByTestId("stat-csat");
    await expect(csat.locator("dd").first()).toContainText("4,00");
    await expect(csat).toContainText("dari 1 penilaian");
    await page.screenshot({ path: `${ART}/r04-browser-3-csat-statistik.png` });
  });

  test("pendamping menutup tiket dengan outcome; ia tidak ditawari verifikasi; SQL: outcome diajukan, tiket selesai", async ({ browser, baseURL }) => {
    test.setTimeout(150_000);
    const page = await sesi(browser, baseURL, "dummy_coach.pendamping@jabarprov.go.id", "/dashboard/klinik");
    await expect(async () => {
      await page.getByRole("button", { name: T1.nama, exact: true }).click();
      await expect(page.getByTestId("pilih-status")).toBeVisible({ timeout: 1500 });
    }).toPass({ timeout: 30_000 });
    await page.getByTestId("pilih-status").selectOption({ label: "Selesai" });
    await page.getByRole("button", { name: "NPWP Usaha: Kepatuhan" }).click();
    await page.getByRole("button", { name: "SOP Tertulis: Perbaikan" }).click();
    await page.screenshot({ path: `${ART}/r04-browser-4-pendamping-tutup-outcome.png` });
    await page.getByRole("button", { name: "Simpan", exact: true }).click();
    const bagian = page.getByTestId("outcome-tiket");
    await expect(bagian.getByTestId("outcome-status")).toHaveText("Menunggu verifikasi", { timeout: 30_000 });
    await expect(bagian.getByTestId("outcome-items")).toContainText("NPWP Usaha");
    await expect(bagian.getByRole("button", { name: /^(Verifikasi|Koreksi|Cabut)$/ })).toHaveCount(0);
    await page.screenshot({ path: `${ART}/r04-browser-5-outcome-diajukan.png` });
    expect(sql(`SELECT t.status || '|' || o.status || '|' || o.versi FROM konsultasi_outcome o JOIN konsultasi_tiket t ON t.id = o.tiket WHERE t.nomor = '${T1.nomor}'`)).toBe("selesai|diajukan|1");
    expect(sql(`SELECT COUNT(*) FROM konsultasi_outcome_item WHERE outcome = (SELECT o.id FROM konsultasi_outcome o JOIN konsultasi_tiket t ON t.id = o.tiket WHERE t.nomor = '${T1.nomor}')`)).toBe("2");
    // Belum diverifikasi: profil tidak berubah.
    expect(sql(`SELECT COUNT(*) FROM konsultasi_outcome WHERE usaha = '${USAHA}' AND status = 'terverifikasi'`)).toBe("0");
  });

  test("kab/kota kota lain tidak melihat tiket maupun outcome; profil usaha di luar wilayah ditolak", async ({ browser, baseURL }) => {
    test.setTimeout(150_000);
    const page = await sesi(browser, baseURL, "r04_kab.sumedang@example.com", "/dashboard/klinik");
    await expect(page.getByTestId("outcome-antrean-kosong")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: T1.nama, exact: true })).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(T1.nomor);
    await page.goto(`/dashboard/data-lapangan/${USAHA}`);
    await expect(page.getByText("Data usaha tidak ditemukan atau di luar wilayah Anda.")).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: `${ART}/r04-browser-6-kota-lain.png` });
  });

  test("provinsi memverifikasi dari antrean (klik ganda aman); profil usaha memuat hasilnya tanpa catatan sesi", async ({ browser, baseURL }) => {
    test.setTimeout(180_000);
    const page = await sesi(browser, baseURL, "dummy_admin@diskuk.jabarprov.go.id", "/dashboard/klinik");
    const antrean = page.getByTestId("outcome-antrean");
    const baris = antrean.getByTestId("outcome-antrean-baris").filter({ hasText: T1.nomor });
    await expect(baris).toBeVisible({ timeout: 30_000 });
    await expect(baris).toContainText(T1.nama);
    await page.screenshot({ path: `${ART}/r04-browser-7-antrean-verifikasi.png` });
    await baris.getByRole("button", { name: "Verifikasi", exact: true }).dblclick();
    await expect(baris).toHaveCount(0, { timeout: 30_000 });
    expect(sql(`SELECT o.status FROM konsultasi_outcome o JOIN konsultasi_tiket t ON t.id = o.tiket WHERE t.nomor = '${T1.nomor}'`)).toBe("terverifikasi");
    expect(sql(`SELECT COUNT(*) FROM konsultasi_outcome_audit WHERE aksi = 'verifikasi' AND outcome = (SELECT o.id FROM konsultasi_outcome o JOIN konsultasi_tiket t ON t.id = o.tiket WHERE t.nomor = '${T1.nomor}')`)).toBe("1");

    await page.goto(`/dashboard/data-lapangan/${USAHA}`);
    const hasil = page.getByTestId("hasil-konsultasi");
    await expect(hasil.getByTestId("hasil-konsultasi-item")).toHaveCount(1, { timeout: 30_000 });
    await expect(hasil).toContainText(T1.nomor);
    await expect(hasil).toContainText("NPWP Usaha · Kepatuhan");
    await expect(hasil).toContainText("SOP Tertulis · Perbaikan");
    const isi = await page.locator("body").innerText();
    for (const rahasia of RAHASIA) expect(isi).not.toContain(rahasia);
    await page.screenshot({ path: `${ART}/r04-browser-8-profil-hasil-konsultasi.png`, fullPage: true });
  });

  test("provinsi mencabut outcome dengan alasan; profil kembali kosong; riwayat audit di SQL", async ({ browser, baseURL }) => {
    test.setTimeout(150_000);
    const page = await sesi(browser, baseURL, "dummy_admin@diskuk.jabarprov.go.id", "/dashboard/klinik");
    await expect(async () => {
      await page.getByRole("button", { name: T1.nama, exact: true }).click();
      await expect(page.getByTestId("outcome-tiket")).toBeVisible({ timeout: 1500 });
    }).toPass({ timeout: 30_000 });
    await page.getByRole("button", { name: "Cabut", exact: true }).click();
    const cabut = page.getByTestId("outcome-form-cabut");
    await cabut.getByLabel("Alasan pencabutan").fill("abc");
    await cabut.getByRole("button", { name: "Cabut outcome" }).click();
    await expect(cabut.getByRole("alert")).toContainText("minimal 5 karakter");
    await cabut.getByLabel("Alasan pencabutan").fill("Bukti tidak lengkap saat verifikasi lanjutan");
    await cabut.getByRole("button", { name: "Cabut outcome" }).click();
    await expect(page.getByTestId("outcome-tiket").getByTestId("outcome-status")).toHaveText("Dicabut", { timeout: 30_000 });
    expect(sql(`SELECT status || '|' || alasan_cabut FROM konsultasi_outcome o WHERE tiket = (SELECT id FROM konsultasi_tiket WHERE nomor = '${T1.nomor}')`)).toBe("dicabut|Bukti tidak lengkap saat verifikasi lanjutan");
    expect(sql(`SELECT string_agg(aksi, '>' ORDER BY id) FROM konsultasi_outcome_audit WHERE outcome = (SELECT o.id FROM konsultasi_outcome o JOIN konsultasi_tiket t ON t.id = o.tiket WHERE t.nomor = '${T1.nomor}')`)).toBe("ajukan>verifikasi>cabut");
    await page.goto(`/dashboard/data-lapangan/${USAHA}`);
    await expect(page.getByTestId("hasil-konsultasi")).toContainText("Belum ada hasil konsultasi terverifikasi.", { timeout: 30_000 });
    await page.screenshot({ path: `${ART}/r04-browser-9-profil-setelah-cabut.png` });
  });
});
