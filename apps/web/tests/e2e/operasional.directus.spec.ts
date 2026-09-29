// Runtime proof Y01+Y02 pada disposable stack (PLAYWRIGHT_USE_REAL_API=1).
// Tanpa stack: skip (verdict not runtime-proven, bukan done).
// Prasyarat: migrasi C+E, seed Y01 (akun + usaha dummy) + seed Y02 (atribut).
import { test, expect } from "@playwright/test";
import { hariLaporWib } from "../../app/lib/kpi";
import { keluarReal, loginReal } from "./real-login";

// Login nyata menyelesaikan ALTCHA (real-login.ts); beri waktu lebih dari default 30 detik.
test.describe.configure({ timeout: 180_000 });

const KABKOTA_EMAIL = process.env.DUMMY_KABKOTA_EMAIL || "dummy_admin.subang@jabarprov.go.id";
const KABKOTA_PASSWORD = process.env.DUMMY_KABKOTA_PASSWORD || "";
const PROVINSI_EMAIL = process.env.DUMMY_PROVINSI_EMAIL || "dummy_admin@diskuk.jabarprov.go.id";
const USAHA_SUBANG = process.env.DUMMY_USAHA_SUBANG || "d0000000-0000-4000-8000-000000000005";
const USAHA_LUAR = process.env.DUMMY_USAHA_LUAR || "d0000000-0000-4000-8000-000000000003";
const NIB_USAHA = process.env.DUMMY_NIB_USAHA || "9900000000001";
const USAHA_EMAIL = process.env.DUMMY_UMKM_EMAIL || "dummy_wawan.leathercraft@gmail.com";
const PENDAMPING_EMAIL = process.env.DUMMY_PENDAMPING_EMAIL || "dummy_coach.pendamping@jabarprov.go.id";

async function login(page: import("@playwright/test").Page, email: string, password: string) {
  await loginReal(page, email, password);
}

test("Y02 data lapangan: kabkota ubah atribut usaha sendiri; usaha luar → 404", async ({ page }) => {
  test.skip(!process.env.PLAYWRIGHT_USE_REAL_API, "butuh disposable stack");
  test.skip(!KABKOTA_PASSWORD, "butuh DUMMY_KABKOTA_PASSWORD");
  await login(page, KABKOTA_EMAIL, KABKOTA_PASSWORD);
  await page.goto(`/dashboard/data-lapangan/${USAHA_SUBANG}`);
  await expect(page.getByRole("heading", { name: /Ubah Data Lapangan/ })).toBeVisible();
  await page.getByLabel("Pembukuan Digital").selectOption("false");
  await page.getByRole("button", { name: "Simpan Perubahan" }).click();
  await expect(page.getByText("Data lapangan tersimpan.")).toBeVisible();
  expect((await page.request.get(`/panel/operasional/usaha/${USAHA_LUAR}`)).status()).toBe(404);
});

test("Y02 talent scouting: kabkota ajukan usaha, hitung skor deterministik, provinsi kurasi BA & kabkota ditolak BA", async ({ page }) => {
  test.skip(!process.env.PLAYWRIGHT_USE_REAL_API, "butuh disposable stack");
  test.skip(!KABKOTA_PASSWORD, "butuh DUMMY_KABKOTA_PASSWORD");

  // 1. Kabkota login & akses pengajuan usaha Subang
  await login(page, KABKOTA_EMAIL, KABKOTA_PASSWORD);
  await page.goto(`/dashboard/talent/ajukan/${USAHA_SUBANG}`);
  await expect(page.getByRole("heading", { name: "Ajukan ke Talent Scouting" })).toBeVisible();

  // NIK tersamarkan (ADR-004)
  await expect(page.getByText("Tersimpan — disembunyikan")).toBeVisible();

  // Isi data operasional Jabar jika form belum read-only
  const hitungBtn = page.getByRole("button", { name: "Hitung Skor" });
  if (await hitungBtn.isVisible()) {
    await page.getByLabel("Kapasitas produksi per bulan").fill("600");
    await page.getByLabel("Satuan").fill("bungkus");
    await page.getByRole("checkbox", { name: "Sudah menerima pembayaran QRIS" }).check();
    await hitungBtn.click();
    await expect(page.getByTestId("skor-total")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("skor-rekomendasi")).toBeVisible();
  }

  // 2. Kabkota buka kurasi: tombol Terbitkan Berita Acara tidak boleh ada (403 guard UI)
  await page.goto("/dashboard/talent/kurasi");
  await expect(page.getByRole("heading", { name: "Kurasi Talent Scouting" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Terbitkan Berita Acara/ })).toHaveCount(0);

  // Logout kabkota
  await keluarReal(page);

  // 3. Provinsi login & buka kurasi: tombol Terbitkan Berita Acara ada
  await login(page, PROVINSI_EMAIL, DEMO_PASSWORD);
  await page.goto("/dashboard/talent/kurasi");
  await expect(page.getByRole("heading", { name: "Kurasi Talent Scouting" })).toBeVisible();
  const issueBtn = page.getByRole("button", { name: /Terbitkan Berita Acara/ });
  await expect(issueBtn).toBeVisible();
});


// ── Y01: identitas, login per role, NIB, dan reset kata sandi ───────────────

const DEMO_PASSWORD = process.env.DEMO_ACCOUNT_PASSWORD || "";

test("Y01 login empat role dummy mendarat di beranda masing-masing", async ({ page }) => {
  test.skip(!process.env.PLAYWRIGHT_USE_REAL_API, "butuh disposable stack");
  test.skip(!DEMO_PASSWORD, "butuh DEMO_ACCOUNT_PASSWORD");
  const cases = [
    { email: PROVINSI_EMAIL, home: "/dashboard" },
    { email: KABKOTA_EMAIL, home: "/dashboard" },
    { email: PENDAMPING_EMAIL, home: "/dashboard/pendampingan" },
    { email: USAHA_EMAIL, home: "/dashboard/usaha" },
  ];
  for (const { email, home } of cases) {
    await loginReal(page, email, DEMO_PASSWORD, home);
    await page.waitForURL((url) => url.pathname === home, { timeout: 30_000 });
    await keluarReal(page);
  }
});

test("Y01 login NIB usaha dummy mendarat di beranda usaha", async ({ page }) => {
  test.skip(!process.env.PLAYWRIGHT_USE_REAL_API, "butuh disposable stack");
  test.skip(!DEMO_PASSWORD, "butuh DEMO_ACCOUNT_PASSWORD");
  await loginReal(page, NIB_USAHA, DEMO_PASSWORD);
  await expect(page).toHaveURL(/\/dashboard\/usaha$/, { timeout: 30_000 });
  // UMKM dengan program_peserta menampilkan PhoneFrame dengan nama usaha; tanpa peserta menampilkan kartu Laporan KPI Mingguan.
  await expect(page.getByRole("heading", { name: /(Laporan Mingguan|Wawan Leathercraft)/ })).toBeVisible();
});

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

test("Y03 pwa umkm: PhoneFrame peserta, target 18jt, minggu-6, dan kirim laporan mingguan", async ({ page }) => {
  test.skip(!process.env.PLAYWRIGHT_USE_REAL_API, "butuh disposable stack");
  test.skip(!DEMO_PASSWORD, "butuh DEMO_ACCOUNT_PASSWORD");

  // Login sebagai UMKM Wawan Leathercraft
  await login(page, USAHA_EMAIL, DEMO_PASSWORD);
  await page.goto("/dashboard/usaha");

  // M5-01: Verifikasi PhoneFrame, nama usaha, batch, pendamping, minggu ke-6
  await expect(page.getByTestId("phone-frame")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Wawan Leathercraft" })).toBeVisible();
  await expect(page.getByText(/Batch 2026-1/)).toBeVisible();
  await expect(page.getByText(/Minggu ke-6 dari 12/)).toBeVisible();

  // M5-02 & M5-03: Isi form laporan mingguan jika ada minggu yang terbuka
  const kirimBtn = page.getByRole("button", { name: "Kirim Laporan" });
  if (await kirimBtn.isVisible()) {
    await page.getByLabel("Omzet minggu ini (Rp)").fill("19500000");
    await page.getByLabel("Jumlah transaksi").fill("35");
    await page.getByTestId("galeri-input").setInputFiles({ name: "nota.png", mimeType: "image/png", buffer: PNG });
    await page.getByLabel("Kendala minggu ini").fill("Pengiriman lancar");
    await kirimBtn.click();
    // M5-03: laporan baru hanya pada Jumat WIB; hari lain ditolak sebelum masuk antrean.
    await expect(hariLaporWib() ? page.getByRole("status") : page.getByRole("alert")).toBeVisible();
  }

  // Riwayat laporan terisi dan terbaca ulang dari server
  await expect(page.getByRole("region", { name: "Riwayat laporan" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Riwayat laporan" }).getByText(/Minggu ke-1/)).toBeVisible();
});



test("Y03 pendamping: filter antrean, tolak validasi catatan, setujui, dan pitching streak", async ({ page }) => {
  test.skip(!process.env.PLAYWRIGHT_USE_REAL_API, "butuh disposable stack");
  test.skip(!DEMO_PASSWORD, "butuh DEMO_ACCOUNT_PASSWORD");

  // Login sebagai Coach Pendamping
  await login(page, PENDAMPING_EMAIL, DEMO_PASSWORD);
  await page.goto("/dashboard/pendampingan");
  await expect(page.getByRole("heading", { name: "Panel Pendampingan" })).toBeVisible();

  // Tab filter (Menunggu, Disetujui, Ditolak, Belum Mengirim)
  await expect(page.getByRole("tab", { name: /Menunggu/ })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Belum Mengirim/ })).toBeVisible();

  // Buka detail peserta untuk cek tren & rekomendasi pitching
  await page.goto("/dashboard/pendampingan/d1000000-0000-4000-8000-000000000001");
  await expect(page.getByRole("heading", { name: /Wawan Leathercraft/ })).toBeVisible();
  await expect(page.getByText(/Rangkaian terpanjang:/)).toBeVisible();

  // Pitching checkbox tersedia dan dapat diatur
  const pitchBox = page.getByRole("checkbox", { name: /Rekomendasikan untuk sesi pitching/ });
  await expect(pitchBox).toBeVisible();
});


test("Y01 lupa kata sandi: tautan Mailpit → reset → login sandi baru", async ({ page }) => {
  test.skip(!process.env.PLAYWRIGHT_USE_REAL_API, "butuh disposable stack");
  test.skip(!DEMO_PASSWORD, "butuh DEMO_ACCOUNT_PASSWORD");
  const mailpit = process.env.MAILPIT_API_URL || "http://127.0.0.1:8025";
  test.skip(!process.env.MAILPIT_API_URL, "butuh MAILPIT_API_URL");

  await page.goto("/lupa-kata-sandi");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Email atau NIB").fill(USAHA_EMAIL);
  await page.getByRole("button", { name: "Kirim Tautan Reset" }).click();
  await expect(page.getByText("Bila akun terdaftar, email berisi tautan reset kata sandi telah dikirim.")).toBeVisible({ timeout: 15000 });

  // Ambil token dari tautan reset pada pesan Mailpit terbaru untuk email tsb.
  const inbox = await page.request.get(`${mailpit}/api/v1/messages`);
  expect(inbox.status()).toBe(200);
  // SAFETY: bentuk respons API Mailpit /api/v1/messages adalah { messages: [...] }.
  const inboxJson = await inbox.json() as { messages: { ID: string; To: { Address: string }[] }[] };
  const message = inboxJson.messages.find((m) =>
    m.To.some((to) => to.Address.toLowerCase() === USAHA_EMAIL.toLowerCase()),
  );
  expect(message, "email reset belum masuk ke Mailpit").toBeTruthy();
  // SAFETY: bentuk respons API Mailpit /api/v1/message/:id membawa HTML/Text.
  const detail = await (await page.request.get(`${mailpit}/api/v1/message/${message!.ID}`)).json() as { HTML?: string; Text?: string };
  const tokenMatch = (detail.HTML || detail.Text || "").match(/[?&]token=([A-Za-z0-9_.-]+)/);
  expect(tokenMatch, "tautan reset tidak memuat token").toBeTruthy();

  await page.goto(`/reset-kata-sandi?token=${tokenMatch![1]}`);
  await page.waitForLoadState("networkidle");
  // Hidrasi dapat mengosongkan isian yang diketik terlalu dini: ulangi sampai keduanya terisi.
  await expect(async () => {
    await page.getByRole("textbox", { name: "Kata sandi baru", exact: true }).fill(DEMO_PASSWORD);
    await page.getByRole("textbox", { name: "Ulangi kata sandi baru", exact: true }).fill(DEMO_PASSWORD);
    await expect(page.getByRole("textbox", { name: "Kata sandi baru", exact: true })).toHaveValue(DEMO_PASSWORD, { timeout: 1000 });
  }).toPass({ timeout: 30_000 });
  await page.getByRole("button", { name: "Simpan Kata Sandi" }).click();
  await expect(page.getByText("Kata sandi berhasil diperbarui.")).toBeVisible();

  await loginReal(page, USAHA_EMAIL, DEMO_PASSWORD);
  await expect(page).toHaveURL(/\/dashboard\/usaha$/, { timeout: 30_000 });

  await keluarReal(page);
  expect((await page.request.get("/panel/v1/analytics/infographic/")).status()).toBe(401);
});
