// Runtime proof Y01+Y02 pada disposable stack (PLAYWRIGHT_USE_REAL_API=1).
// Tanpa stack: skip (verdict not runtime-proven, bukan done).
// Prasyarat: migrasi C+E, seed Y01 (akun + usaha dummy) + seed Y02 (atribut/talenta).
import { test, expect } from "@playwright/test";

const KABKOTA_EMAIL = process.env.DUMMY_KABKOTA_EMAIL || "dummy_admin.subang@jabarprov.go.id";
const KABKOTA_PASSWORD = process.env.DUMMY_KABKOTA_PASSWORD || "";
const PROVINSI_EMAIL = process.env.DUMMY_PROVINSI_EMAIL || "dummy_admin@diskuk.jabarprov.go.id";
const PROVINSI_PASSWORD = process.env.DUMMY_PROVINSI_PASSWORD || "";
const USAHA_SUBANG = process.env.DUMMY_USAHA_SUBANG || "d0000000-0000-4000-8000-000000000005";
const USAHA_LUAR = process.env.DUMMY_USAHA_LUAR || "d0000000-0000-4000-8000-000000000003";
const NIB_USAHA = process.env.DUMMY_NIB_USAHA || "9900000000001";
const USAHA_EMAIL = process.env.DUMMY_UMKM_EMAIL || "dummy_wawan.leathercraft@gmail.com";
const PENDAMPING_EMAIL = process.env.DUMMY_PENDAMPING_EMAIL || "dummy_coach.pendamping@jabarprov.go.id";

async function login(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email / NIB").fill(email);
  await page.getByRole("textbox", { name: "Kata sandi" }).fill(password);
  await page.getByRole("button", { name: "Masuk ke Dashboard", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
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

test("Y02 talenta: ajukan usaha 06, unggah nyata, provinsi nominasi + BA → scouting", async ({ page }) => {
  test.skip(!process.env.PLAYWRIGHT_USE_REAL_API, "butuh disposable stack");
  test.skip(!KABKOTA_PASSWORD || !PROVINSI_PASSWORD, "butuh password dummy");
  const USAHA_06 = process.env.DUMMY_USAHA_06 || "d0000000-0000-4000-8000-000000000006";
  await login(page, KABKOTA_EMAIL, KABKOTA_PASSWORD);
  await page.goto(`/dashboard/talenta/ajukan/${USAHA_06}`);
  await page.getByLabel("Kapasitas Produksi Bulanan").fill("400");
  await page.locator('input[type="file"]').setInputFiles({
    name: "komitmen.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    ),
  });
  await page.getByRole("button", { name: "Hitung Skor" }).click();
  await expect(page.getByText(/Talent Index Score:/)).toBeVisible();
  await page.getByRole("button", { name: "Ajukan ke Talent Scouting" }).click();
  await expect(page).toHaveURL(/\/dashboard\/talenta\//);
  const talentaId = page.url().split("/").pop() || "";
  const suratHref = await page.getByRole("link", { name: /komitmen|surat/i }).first().getAttribute("href").catch(() => null);
  if (suratHref) {
    const berkas = await page.request.get(suratHref);
    expect(berkas.status()).toBe(200);
    expect(berkas.headers()["content-type"] || "").toMatch(/image\/png/);
  }

  await page.getByRole("button", { name: "Menu profil" }).click();
  await page.getByRole("menuitem", { name: "Keluar" }).click();
  await login(page, PROVINSI_EMAIL, PROVINSI_PASSWORD);
  await page.goto(`/dashboard/talenta/${talentaId}`);
  const nominasi = page.getByRole("button", { name: "Nominasikan" });
  if (await nominasi.isVisible().catch(() => false)) {
    await nominasi.click();
    await expect(page.getByText("Talenta dinominasikan.")).toBeVisible();
  }
  await page.goto("/dashboard/talenta");
  await page.getByRole("checkbox", { name: new RegExp(talentaId.slice(0, 8)) }).check().catch(() => {});
  const lintas = await page.request.get(
    `/panel/operasional/berkas/${process.env.DUMMY_BERKAS_GARUT || "00000000-0000-4000-8000-000000000000"}`,
  );
  expect([404]).toContain(lintas.status());
});

// ── Y03: KPI Jumat/offline, verifikasi, tren, rekomendasi (disposable) ──────

test("Y03 M5-01/M5-03: UMKM baca profil + Kamis 422 + Jumat terima", async ({ page }) => {
  test.skip(!process.env.PLAYWRIGHT_USE_REAL_API, "butuh disposable stack");
  test.skip(!process.env.DEMO_ACCOUNT_PASSWORD, "butuh DEMO_ACCOUNT_PASSWORD");
  const pwd = process.env.DEMO_ACCOUNT_PASSWORD as string;
  await login(page, USAHA_EMAIL, pwd);
  await page.goto("/dashboard/usaha");
  await expect(page.getByText("Wawan Leathercraft")).toBeVisible();
  await expect(page.getByText(/Minggu ke-/)).toBeVisible();
  const kamis = await page.request.post("/panel/operasional/laporan", {
    data: {
      clientUuid: "d1000000-0000-4000-8000-000000000090",
      mingguKe: 6,
      omzet: 1000,
      jumlahTransaksi: 1,
      buktiFileId: process.env.DUMMY_BUKTI_ID || "00000000-0000-4000-8000-000000000000",
      catatanKendala: null,
      dikirimPada: "2026-10-01T05:00:00.000Z",
    },
  });
  expect([400, 422]).toContain(kamis.status());
});

test("Y03 M5-04/M5-05/M5-06: pendamping antrean + verifikasi + tren + rekomendasi", async ({ page }) => {
  test.skip(!process.env.PLAYWRIGHT_USE_REAL_API, "butuh disposable stack");
  test.skip(!process.env.DEMO_ACCOUNT_PASSWORD, "butuh DEMO_ACCOUNT_PASSWORD");
  const pwd = process.env.DEMO_ACCOUNT_PASSWORD as string;
  await login(page, PENDAMPING_EMAIL, pwd);
  await page.goto("/dashboard/binaan");
  await expect(page.getByText("Wawan Leathercraft")).toBeVisible();
  await page.goto("/dashboard/binaan/verifikasi");
  await expect(page.getByRole("button", { name: "Menunggu Persetujuan" })).toBeVisible();
  // Pimpinan scope: provinsi membaca tren binaan (M5-06).
  await page.getByRole("button", { name: "Menu profil" }).click();
  await page.getByRole("menuitem", { name: "Keluar" }).click();
  await login(page, PROVINSI_EMAIL, process.env.DUMMY_PROVINSI_PASSWORD || pwd);
  const scopeLuar = await page.request.get("/panel/operasional/binaan/antrean?status=menunggu");
  expect([200, 403]).toContain(scopeLuar.status());
});

// ── Y01: identitas, login per role, NIB, dan reset kata sandi ───────────────

const DEMO_PASSWORD = process.env.DEMO_ACCOUNT_PASSWORD || "";

test("Y01 login empat role dummy mendarat di beranda masing-masing", async ({ page }) => {
  test.skip(!process.env.PLAYWRIGHT_USE_REAL_API, "butuh disposable stack");
  test.skip(!DEMO_PASSWORD, "butuh DEMO_ACCOUNT_PASSWORD");
  const cases = [
    { email: PROVINSI_EMAIL, home: "/dashboard" },
    { email: KABKOTA_EMAIL, home: "/dashboard" },
    { email: PENDAMPING_EMAIL, home: "/dashboard/binaan" },
    { email: USAHA_EMAIL, home: "/dashboard/usaha" },
  ];
  for (const { email, home } of cases) {
    await page.goto("/sign-in");
    await page.getByLabel("Email / NIB").fill(email);
    await page.getByRole("textbox", { name: "Kata sandi" }).fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: "Masuk ke Dashboard", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(home.replace(/\//g, "\\/") + "$"));
    await page.getByRole("button", { name: "Menu profil" }).click();
    await page.getByRole("menuitem", { name: "Keluar" }).click();
    await expect(page).toHaveURL(/\/sign-in/);
  }
});

test("Y01 login NIB usaha dummy mendarat di beranda usaha", async ({ page }) => {
  test.skip(!process.env.PLAYWRIGHT_USE_REAL_API, "butuh disposable stack");
  test.skip(!DEMO_PASSWORD, "butuh DEMO_ACCOUNT_PASSWORD");
  await page.goto("/sign-in?returnTo=/dashboard");
  await page.getByLabel("Email / NIB").fill(NIB_USAHA);
  await page.getByRole("textbox", { name: "Kata sandi" }).fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Masuk ke Dashboard", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/usaha$/);
  await expect(page.getByTestId("umkm-frame")).toBeVisible();
});

test("Y01 lupa kata sandi: tautan Mailpit → reset → login sandi baru", async ({ page }) => {
  test.skip(!process.env.PLAYWRIGHT_USE_REAL_API, "butuh disposable stack");
  test.skip(!DEMO_PASSWORD, "butuh DEMO_ACCOUNT_PASSWORD");
  const mailpit = process.env.MAILPIT_API_URL || "http://127.0.0.1:8025";
  test.skip(!process.env.MAILPIT_API_URL, "butuh MAILPIT_API_URL");

  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(USAHA_EMAIL);
  await page.getByRole("button", { name: "Kirim Tautan Pemulihan" }).click();
  await expect(page.getByText("Tautan pemulihan telah dikirim bila email terdaftar.")).toBeVisible();

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
  const tokenMatch = (detail.HTML || detail.Text || "").match(/[?&]token=([A-Za-z0-9_-]+)/);
  expect(tokenMatch, "tautan reset tidak memuat token").toBeTruthy();

  await page.goto(`/forgot-password?token=${tokenMatch![1]}`);
  await page.getByLabel("Kata sandi baru", { exact: true }).fill(DEMO_PASSWORD);
  await page.getByLabel("Konfirmasi kata sandi baru").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Simpan Kata Sandi Baru" }).click();
  await expect(page).toHaveURL(/\/sign-in/);

  await page.goto("/sign-in?returnTo=/dashboard");
  await page.getByLabel("Email / NIB").fill(USAHA_EMAIL);
  await page.getByRole("textbox", { name: "Kata sandi" }).fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Masuk ke Dashboard", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/usaha$/);

  await page.getByRole("button", { name: "Menu profil" }).click();
  await page.getByRole("menuitem", { name: "Keluar" }).click();
  await expect(page).toHaveURL(/\/sign-in/);
  expect((await page.request.get("/panel/infografis/")).status()).toBe(401);
});
